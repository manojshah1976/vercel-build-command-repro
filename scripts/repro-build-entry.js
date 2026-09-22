#!/usr/bin/env node
/**
 * Mirrors the outer shape of our real scripts/vercel-build.js: the
 * `vercel-build` npm script runs THIS with stdio inherited (execSync), which
 * in turn runs scripts/repro-parallel.js - the concurrent-spawn/piped-stdout
 * script - as its own child process. That's the same two-level nesting our
 * real build has (npm run vercel-build -> vercel-build.js -> parallel-build.js),
 * kept in case the nesting itself (rather than just the concurrent spawns)
 * matters to whatever is happening on the platform side.
 */
import { execSync } from "child_process";

const invocationId = crypto.randomUUID();
console.log(`[repro-build-entry] invocation=${invocationId} started=${new Date().toISOString()}`);
console.log(`[repro-build-entry] pid=${process.pid} cwd=${process.cwd()}`);

execSync("node scripts/repro-parallel.js", { stdio: "inherit" });

console.log(`[repro-build-entry] invocation=${invocationId} completed=${new Date().toISOString()}`);
