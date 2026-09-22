# vercel-build-command-repro

Minimal, public reproduction for a Vercel support case investigating a
repeated build in the original (private) project. Four scenarios live
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

## Scenario 3 — warm build-cache restore (confirmed clean)

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

This scenario needed **two deployments of the same commit**, not one:

1. **First deployment** (`dpl_7ztJLh4BF2bqHM8ke2VAa9C9JpJ2`, build
   `bld_3yua5bl01`) — cold, formed a real 496 kB build cache
   (`Created build cache: 801ms` / `Uploading build cache [496.00 kB]`).
2. **Second deployment** (`dpl_CrkhPKm8uxYHUdiqFtw3QbZGTodU`, build
   `bld_akzit4qv3`, a redeploy of the same commit) — logged `Restored
   build cache from previous deployment (7ztJLh4BF2bqHM8ke2VAa9C9JpJ2)`,
   confirming the cache-restore path genuinely ran.

**Result: confirmed clean.** Both deployments' logs are in order: one
`Running "npm run vercel-build"` header, one invocation UUID pair, all 7
task outputs exactly once, nothing out of order — on the cold deploy *and*
the cache-restoring one. Warm cache restore isn't the cause either.

## Scenario 4 — real Vite, same version as our real project (currently active)

Scenarios 1–3 ruled out concurrency and caching, but none of them used
real Vite — 1 and 2 used a trivial script or `node -e` one-liners, and 3
only added a dependency (`lodash`) for cache weight, not an actual bundler.
It's possible the anomaly is specific to Vite/esbuild/rolldown's own
process-spawning behaviour (esbuild and rolldown each shell out to a
native binary) rather than to generic Node child processes.

This scenario is the most faithful reproduction this repo can carry
without including any of the real (private) project's actual source:

- `vite@^8.0.16` — the **exact same version** our real project depends on
  (`package.json` line 128 there).
- Three real, separate Vite configs (`vite.main.config.js`,
  `vite.fluent-report.config.js`, `vite.bonus-game.config.js`), each with
  its own `root`/`outDir`, matching the shape of our real
  `vite.main.config.ts` / `vite.fluent-report.config.ts` /
  `vite.bonus-game.config.ts`.
- Three small apps under `apps/main-app`, `apps/fluent-report`,
  `apps/bonus-game`, each importing a **synthetic** placeholder data file
  (randomly generated strings, 80–125 KB each — not derived from any real
  content) purely to give the real bundler genuine, non-trivial transform/
  minify work rather than an empty build.
- `scripts/repro-parallel-real.js` is the same spawn/pipe/prefix
  orchestration as scenario 2/3 (already proven clean on its own), but now
  spawning **real** `npx vite build` processes instead of fake ones — same
  chained `sh -c "vite build ... && node ..."` shape for the main-app-like
  task as our real pipeline.
- `node_modules` is real Vite's own dependency tree (~38 MB locally),
  giving Vercel a real, organic build cache rather than an artificially
  padded one.

This combines everything tested so far (concurrent spawns, piped/prefixed
output, a real dependency-driven cache) with the one remaining untested
variable — the real bundler's own subprocess behaviour — in one scenario,
since each prior variable was already individually ruled out.

## How to check

Open the deployment's build log and look for:

1. How many `Running "npm run vercel-build"` headers appear, and whether
   any `[main-app-like]`/`[fluent-report-like]`/etc. output appears **before**
   the first one.
2. How many distinct invocation UUIDs appear for the active scenario's
   entry/parallel scripts (`[repro-build-entry]`/`[repro-parallel]` for
   scenarios 2–3, `[repro-build-entry-real]`/`[repro-parallel-real]` for
   scenario 4).
3. For scenario 4 specifically: whether real Vite's own output
   (`vite v8.x.x building client environment...`, `✓ N modules
   transformed`, `rendering chunks...`, etc.) appears more than once per
   deployment, or before the build-command header.

A single deployment should produce exactly one `Running "npm run
vercel-build"` header and one of each UUID. Output appearing before that
header, or a repeated UUID or Vite build block, narrows the cause to
whatever that scenario adds on top of the ones already ruled out.

## Switching scenarios

Only one scenario can be the active `buildCommand` at a time (Vercel only
runs whatever `npm run vercel-build` resolves to). `package.json` keeps a
script per scenario:

- `vercel-build:baseline` — scenario 1
- `vercel-build:scenario2` — scenario 2 (fake concurrent tasks, no cache
  dependency; remove `lodash`/`vite` from `dependencies`/`devDependencies`
  to match exactly)
- `vercel-build` (current) — scenario 4, real Vite

To go back to scenario 3 specifically: keep the `lodash` dependency,
remove `vite`, and point `vercel-build` at
`node scripts/repro-build-entry.js`.
