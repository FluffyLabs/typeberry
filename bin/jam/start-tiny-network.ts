#!/usr/bin/env tsx
// biome-ignore-all lint/suspicious/noConsole: bin file

// Start a tiny network of 6 JAM nodes

import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tinyChainSpec } from "@typeberry/config";

const LOGS_DIR = "./logs";
const NUM_NODES = tinyChainSpec.validatorsCount;

async function main() {
  const args = process.argv.slice(2);
  const fastForward = args.includes("--fast-forward");

  if (fastForward) {
    console.log("Fast-forward mode enabled");
  }

  // Create logs directory
  await mkdir(LOGS_DIR, { recursive: true });

  console.log(`Starting ${NUM_NODES}-node JAM network...`);
  console.log(`Logs will be written to: ${LOGS_DIR}`);
  console.log("");

  const pids: number[] = [];

  // Start each node
  for (let i = 0; i < NUM_NODES; i++) {
    const nodeArgs = ["start", "dev", "--", String(i)];
    if (fastForward) {
      nodeArgs.push("--fast-forward");
    }

    const logFile = join(LOGS_DIR, `node-${i}.log`);
    const logFd = openSync(logFile, "w");

    const child = spawn("npm", nodeArgs, {
      stdio: ["ignore", logFd, logFd],
      detached: true,
      cwd: process.cwd(),
    });

    child.unref();

    if (child.pid) {
      pids.push(child.pid);
      console.log(`  Node ${i} started (PID: ${child.pid})`);
    } else {
      console.error(`  Failed to start node ${i}`);
    }
  }

  // Save PIDs to file
  const pidFile = join(LOGS_DIR, ".pids");
  await writeFile(pidFile, pids.join("\n"));

  console.log("");
  console.log("All nodes started successfully!");
  console.log(`PIDs saved to: ${pidFile}`);
  console.log("");
  console.log("To view logs:");
  console.log(`  tail -f ${LOGS_DIR}/node-0.log`);
  console.log(`  tail -f ${LOGS_DIR}/node-*.log  # all logs`);
  console.log("");
  console.log("To stop all nodes:");
  console.log("  npm run stop-tiny-network");
}

main().catch((err) => {
  console.error("Error starting network:", err);
  process.exit(1);
});
