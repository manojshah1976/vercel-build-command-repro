# vercel-build-command-repro

Minimal, public reproduction for a Vercel support case investigating a
repeated build in the original (private) project. Two scenarios live here,
kept deliberately separate so each tests one variable at a time.

## Scenario 1 — baseline (confirmed clean)

- `package.json`'s `vercel-build:baseline` script runs
  `scripts/minimal-build-repro.js`.
- Performs **no linting, no framework build, no tests, no child processes,
  no retries, no recursion**. Logs one UUID, PID, and start/completion
  timestamp, then exits.
- Vercel support (Callum) deployed this and confirmed it prints its 3 lines
  once and does **not** repeat — it does not reproduce the issue.

## Scenario 2 — concurrent spawned children (currently active)

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
scenario tests whether the spawn/pipe/prefix *pattern* alone — independent
of Vite, of build duration, and of build-cache size — is enough to trigger
that.

## How to check

Open the deployment's build log and look for:

1. How many `Running "npm run vercel-build"` headers appear, and whether
   any `[main-app-like]`/`[fluent-report-like]`/etc. output appears **before**
   the first one.
2. How many distinct `[repro-build-entry] invocation=<UUID>` and
   `[repro-parallel] invocation=<UUID>` values appear.

A single deployment should produce exactly one `Running "npm run
vercel-build"` header and one of each UUID. Output appearing before that
header, or a repeated UUID, would narrow the cause down to the
spawn/pipe/prefix mechanism itself.

## Switching scenarios

Only one scenario can be the active `buildCommand` at a time (Vercel only
runs whatever `npm run vercel-build` resolves to). To go back to Scenario 1,
either:

- change `package.json`'s `vercel-build` script back to
  `node scripts/minimal-build-repro.js`, or
- change `vercel.json`'s `buildCommand` to
  `"npm run vercel-build:baseline"`.
