#!/usr/bin/env node
/**
 * Scenario 4 - the most faithful reproduction of our real build pipeline
 * this repo can carry: REAL Vite (same version as our real project,
 * ^8.0.16), three real concurrent `vite build` invocations against real
 * (synthetic-content) source, run via the exact same spawn/pipe/prefix
 * orchestration proven clean in scenarios 2 and 3. Only the app source is
 * placeholder - the build tooling and process shape are the genuine thing.
 */
import { spawn } from "child_process";

const invocationId = crypto.randomUUID();

const tasks = [
  {
    name: "main-app-like",
    cmd: "sh",
    args: [
      "-c",
      "npx vite build --config vite.main.config.js && node scripts/repro-post-main.js",
    ],
  },
  { name: "fluent-report-like", cmd: "npx", args: ["vite", "build", "--config", "vite.fluent-report.config.js"] },
  { name: "bonus-game-like", cmd: "npx", args: ["vite", "build", "--config", "vite.bonus-game.config.js"] },
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

console.log(`[repro-parallel-real] invocation=${invocationId} started=${new Date().toISOString()}`);
console.log(`[repro-parallel-real] pid=${process.pid} cwd=${process.cwd()}`);

const start = Date.now();
console.log(`Running ${tasks.length} build tasks in parallel…`);

try {
  await Promise.all(tasks.map(runTask));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`All builds completed in ${elapsed}s`);
  console.log(`[repro-parallel-real] invocation=${invocationId} completed=${new Date().toISOString()}`);
} catch (err) {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
}
