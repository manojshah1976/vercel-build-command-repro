# vercel-build-command-repro

Minimal, public reproduction for a Vercel support case investigating whether
Vercel's configured `buildCommand` is invoked more than once per deployment,
independent of anything the invoked script itself does.

## What this is

- `vercel.json` sets `buildCommand: "npm run vercel-build"` — the same
  mechanism used by the original (private) project this case was opened
  against, with every unrelated setting (headers, rewrites, functions,
  crons) stripped out. `installCommand`/`outputDirectory` are the minimum
  needed for a clean deploy.
- `package.json`'s `vercel-build` script points at
  `scripts/minimal-build-repro.js`.
- `scripts/minimal-build-repro.js` performs **no linting, no framework
  build, no tests, no child processes, no retries, no recursion**. It only
  logs a freshly generated UUID, the process ID, and start/completion
  timestamps, then exits.

## How to check

Open the deployment's build log and count:

1. How many `Running "npm run vercel-build"` headers appear.
2. How many distinct `[minimal-build-repro] invocation=<UUID>` values appear.

A single deployment should produce **exactly one** `Running "npm run
vercel-build"` header and **one** matching `started`/`completed` UUID pair.
More than one UUID in one deployment's log means the configured build
command was invoked more than once, independent of anything the script
itself does — this repro is deliberately too simple to cause that on its
own.
