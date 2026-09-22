#!/usr/bin/env node

const invocationId = crypto.randomUUID();
console.log(`[minimal-build-repro] invocation=${invocationId} started=${new Date().toISOString()}`);
console.log(`[minimal-build-repro] pid=${process.pid} cwd=${process.cwd()}`);
console.log(`[minimal-build-repro] invocation=${invocationId} completed=${new Date().toISOString()}`);
