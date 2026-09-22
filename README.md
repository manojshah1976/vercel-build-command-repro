# vercel-build-command-repro

Minimal, public reproduction for a Vercel support case investigating a
repeated build in the original (private) project. Three scenarios live
here, kept deliberately separate so each tests one variable at a time.

## Scenario 1 — baseline (confirmed clean)

- `package.json`'s `vercel-build:baseline` script runs
  `scripts/minimal-build-repro.js`.
- Performs **no linting, no framework build, no tests, no child processes,
  no retries, no recursion**. Logs one UUID, PID, and start/completion
  timestamp, then exits.
- Vercel support (Callum) deployed this and confirmed it prints its 3 lines
  once and does **not** repeat — it does not reproduce the issue.

## Scenario 2 — concurrent spawned children (confirmed clean)

This is what `vercel.json`'s `buildCommand: "npm run vercel-build"` now
runs. It's a faithful copy of the ONE mechanism the real project's build has
that Scenario 1 doesn't: several child processes spawned **concurrently**,
each with **piped** (not inherited) stdout/stderr, re-printed through the
parent process with a `[name]` prefix — plus the same two-level nesting
(`vercel-build` script → `execSync` a script with `stdio: "inherit"` → that
script `spawn`s 7 children with `stdio: ["ignore","pipe","pipe"]`).

- `scripts/repro-build-entry.js` mirrors our real `scripts/vercel-build.js`
  (the outer `execSync`/`stdio: "inherit"` step).
- `scripts/repro-parallel.js` mirrors our real `scripts/parallel-build.js`
  line-for-line (spawn + piped stdio + per-line `[name]` prefixing +
  `Promise.all`) — only the 7 actual task commands are swapped for trivial
  ones (one of them a chained `sh -c "cmd1 && cmd2"`, matching the one real
  task that isn't a single subprocess) so the whole thing runs in well under
  a second instead of several minutes.

In the real project's build log, the anomaly is that this exact
concurrent/piped/prefixed pattern's output (three Vite sub-builds:
`[main-app]`, `[bonus-game]`, `[fluent-report]`) appears to complete once
**before** Vercel's own `Running "npm run vercel-build"` header is printed
at all, then genuinely runs again afterward as the real invocation. This
scenario tested whether the spawn/pipe/prefix *pattern* alone — independent
of Vite, of build duration, and of build-cache size — is enough to trigger
that.

**Result: confirmed clean.** Deployed on the linked Vercel project
(`vercel-build-command-repro-2kp33h94z.vercel.app`, build `bld_2zmf2pmta`).
The full build log is in order: one `Running "npm run vercel-build"`
header, one `[repro-build-entry]`/`[repro-parallel]` invocation UUID pair,
all 7 task outputs exactly once, nothing before the header. That rules out
the spawn/pipe/prefix pattern on its own as the cause.

## Scenario 3 — warm build-cache restore (currently active)

Scenarios 1 and 2 were both **cold, cache-less first deploys** — every
deployment so far logged `Previous build caches not available` and
`Skipping cache upload because no files were prepared`, because this repo
had zero dependencies, so there was nothing for Vercel to cache. The real
project's affected deployment, by contrast, had a **142.28 MB build cache**
being restored and re-uploaded in the same build. Neither prior scenario
touched that code path at all.

- `package.json` now depends on `lodash` (a small, real, ordinary
  dependency — nothing exotic) purely so `npm install` produces a non-empty
  `node_modules` for Vercel to actually cache between deployments.
- The build command itself (`scripts/repro-build-entry.js` →
  `scripts/repro-parallel.js`, scenario 2's script) is unchanged, so this
  scenario adds exactly one variable: **a warm cache restore**, isolated
  from everything already ruled out.

This scenario needs **two deployments of the same commit**, not one:

1. **First deployment** — cold, forms the cache (same as scenarios 1/2,
   nothing new expected here).
2. **Second deployment** (a plain redeploy of the same commit, no code
   change) — restores the cache from step 1. This is the one that tests the
   hypothesis: does cache restoration cause the build-command's output (or
   the header itself) to appear more than once, or out of order?

## How to check

Open the deployment's build log and look for:

1. How many `Running "npm run vercel-build"` headers appear, and whether
   any `[main-app-like]`/`[fluent-report-like]`/etc. output appears **before**
   the first one.
2. How many distinct `[repro-build-entry] invocation=<UUID>` and
   `[repro-parallel] invocation=<UUID>` values appear.
3. For scenario 3 specifically: whether the *second* deployment's log
   differs from the first in any of the above, once a warm cache is
   actually being restored (look for `Restored build cache` or similar,
   as opposed to `Previous build caches not available`).

A single deployment should produce exactly one `Running "npm run
vercel-build"` header and one of each UUID, on every deployment regardless
of cache state. Output appearing before that header, or a repeated UUID —
especially only on the cache-restoring second deployment — would narrow
the cause down to cache-restore handling specifically.

## Switching scenarios

Only one scenario can be the active `buildCommand` at a time (Vercel only
runs whatever `npm run vercel-build` resolves to). To go back to an earlier
scenario, change `package.json`'s `vercel-build` script:

- Scenario 1: `"vercel-build": "node scripts/minimal-build-repro.js"`
- Scenario 2 (no cache dependency): remove the `lodash` dependency and set
  `"vercel-build": "node scripts/repro-build-entry.js"`
- Scenario 3 (current): keep the `lodash` dependency, same script as
  scenario 2.
