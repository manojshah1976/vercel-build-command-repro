#!/usr/bin/env node
/**
 * Same outer shape as scripts/repro-build-entry.js (scenario 2/3), but
 * runs scripts/repro-parallel-real.js - scenario 4's real-Vite variant.
 */
import { execSync } from "child_process";

const invocationId = crypto.randomUUID();
console.log(`[repro-build-entry-real] invocation=${invocationId} started=${new Date().toISOString()}`);
console.log(`[repro-build-entry-real] pid=${process.pid} cwd=${process.cwd()}`);

execSync("node scripts/repro-parallel-real.js", { stdio: "inherit" });

console.log(`[repro-build-entry-real] invocation=${invocationId} completed=${new Date().toISOString()}`);
