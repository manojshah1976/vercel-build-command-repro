#!/usr/bin/env node
/**
 * Reproduces the ONE mechanism our real vercel-build pipeline has that this
 * minimal repro's baseline script (minimal-build-repro.js) does not: several
 * child processes spawned CONCURRENTLY, each with piped (not inherited)
 * stdout/stderr, re-printed through the parent with a "[name]" prefix.
 *
 * This is a line-for-line copy of the orchestration in our real
 * scripts/parallel-build.js (spawn + stdio:["ignore","pipe","pipe"] +
 * per-line prefixing + Promise.all) - only the actual task commands are
 * replaced with trivial ones so this runs in well under a second instead of
 * several minutes. One task ("main-app-like") is a two-step chained shell
 * command (`sh -c "cmd1 && cmd2"`), matching the one real task that isn't a
 * single subprocess.
 */
import { spawn } from "child_process";

const invocationId = crypto.randomUUID();

const tasks = [
  {
    name: "main-app-like",
    cmd: "sh",
    args: ["-c", 'node -e "console.log(1)" && node -e "console.log(2)"'],
  },
  { name: "fluent-report-like", cmd: "node", args: ["-e", "console.log('fluent report task')"] },
  { name: "bonus-game-like", cmd: "node", args: ["-e", "console.log('bonus game task')"] },
  { name: "blog-like", cmd: "node", args: ["-e", "console.log('blog task')"] },
  { name: "site-analytics-like", cmd: "node", args: ["-e", "console.log('site analytics task')"] },
  { name: "sitemap-like", cmd: "node", args: ["-e", "console.log('sitemap task')"] },
  { name: "llms-like", cmd: "node", args: ["-e", "console.log('llms task')"] },
];

function runTask({ name, cmd, args }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    proc.stdout.on("data", (d) => {
      for (const line of d.toString().split("\n").filter(Boolean)) console.log(`[${name}] ${line}`);
    });
    proc.stderr.on("data", (d) => {
      for (const line of d.toString().split("\n").filter(Boolean)) console.error(`[${name}] ${line}`);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
  });
}

console.log(`[repro-parallel] invocation=${invocationId} started=${new Date().toISOString()}`);
console.log(`[repro-parallel] pid=${process.pid} cwd=${process.cwd()}`);

const start = Date.now();
console.log(`Running ${tasks.length} build tasks in parallel…`);

try {
  await Promise.all(tasks.map(runTask));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`All builds completed in ${elapsed}s`);
  console.log(`[repro-parallel] invocation=${invocationId} completed=${new Date().toISOString()}`);
} catch (err) {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
}
