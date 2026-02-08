#!/usr/bin/env tsx
// biome-ignore-all lint/suspicious/noConsole: bin file

// Manage a tiny network of 6 JAM nodes

import { type ChildProcess, spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { tinyChainSpec } from "@typeberry/config";

// Generate distinct colors using 256-color palette
function getNodeColor(nodeIndex: number): string {
  // Handpicked distinct, bright colors that work well on dark terminals
  const colors = [196, 46, 226, 51, 201, 208, 87, 135, 166, 39, 213, 118];
  // Red, Green, Yellow, Cyan, Magenta, Orange, LightCyan, Purple, Brown, Blue, Pink, LightGreen
  const colorIndex = colors[nodeIndex % colors.length];
  return `\x1b[38;5;${colorIndex}m`;
}
const RESET = "\x1b[0m";

const LOGS_DIR = "./logs";
const NUM_NODES = tinyChainSpec.validatorsCount;

const children: ChildProcess[] = [];

function stopAllNodes() {
  console.log("");
  console.log(`Stopping ${children.length} nodes...`);

  for (const child of children) {
    if (child.pid !== undefined) {
      try {
        child.kill("SIGTERM");
        console.log(`  Stopped node with PID: ${child.pid}`);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ESRCH") {
          console.log(`  Node with PID ${child.pid} is not running`);
        } else {
          console.error(`  Failed to stop node with PID ${child.pid}:`, err);
        }
      }
    }
  }

  console.log("");
  console.log("All nodes stopped.");
}

async function startTinyNetwork(fastForward: boolean, liveMode: boolean) {
  if (fastForward) {
    console.log("Fast-forward mode enabled");
  }
  if (liveMode) {
    console.log("Live mode enabled - logs will be displayed in terminal with colors");
  }

  // Clean up old logs (only in file mode)
  if (!liveMode) {
    try {
      await rm(LOGS_DIR, { recursive: true, force: true });
      console.log("Cleaned up old logs");
      console.log("");
    } catch {
      // Ignore if directory doesn't exist
    }

    // Create logs directory
    await mkdir(LOGS_DIR, { recursive: true });
  }

  console.log(`Starting ${NUM_NODES}-node JAM network...`);
  if (!liveMode) {
    console.log(`Logs will be written to: ${LOGS_DIR}`);
  }
  console.log("");

  // Start each node with staggered timing to avoid networking race conditions
  // (see bin/jam/test/e2e.ts: "introducing some timeout, due to networking issues when started at the same time")
  for (let i = 0; i < NUM_NODES; i++) {
    const nodeArgs = ["start", "--", "dev", String(i)];
    if (fastForward) {
      nodeArgs.push("--fast-forward");
    }

    console.log(`  Starting node ${i}: npm ${nodeArgs.join(" ")}`);

    let child: ChildProcess;

    if (liveMode) {
      // Live mode: pipe stdout/stderr and colorize
      child = spawn("npm", nodeArgs, {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: process.cwd(),
      });

      const nodeIndex = i;
      const color = getNodeColor(nodeIndex);
      if (child.stdout !== null) {
        const rl = createInterface({ input: child.stdout });
        rl.on("line", (line: string) => {
          console.log(`${color}[node-${nodeIndex}]${RESET} ${line}`);
        });
      }
      if (child.stderr !== null) {
        const rl = createInterface({ input: child.stderr });
        rl.on("line", (line: string) => {
          console.log(`${color}[node-${nodeIndex}]${RESET} ${line}`);
        });
      }
    } else {
      // File mode: write to log files
      const logFile = join(LOGS_DIR, `node-${i}.log`);
      const logFd = openSync(logFile, "w");

      child = spawn("npm", nodeArgs, {
        stdio: ["ignore", logFd, logFd],
        cwd: process.cwd(),
      });
    }

    children.push(child);

    if (child.pid !== undefined) {
      console.log(`    PID: ${child.pid}`);
    } else {
      console.error(`    Failed to start node ${i}`);
    }

    // Wait 1 second before starting next node to avoid networking issues
    if (i < NUM_NODES - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log("");
  console.log("All nodes started successfully!");
  console.log("");
  if (!liveMode) {
    console.log("To view logs:");
    console.log(`  tail -f ${LOGS_DIR}/node-0.log`);
    console.log(`  tail -f ${LOGS_DIR}/node-*.log  # all logs`);
    console.log("");
  }
  console.log("Press Ctrl+C to stop all nodes.");

  // Keep the process running
  await new Promise(() => {});
}

async function main() {
  const args = process.argv.slice(2);
  const fastForward = args.includes("--fast-forward");
  const liveMode = args.includes("--live");

  // Handle termination signals
  process.on("SIGINT", () => {
    stopAllNodes();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    stopAllNodes();
    process.exit(0);
  });

  await startTinyNetwork(fastForward, liveMode);
}

main().catch((err) => {
  console.error("Error:", err);
  stopAllNodes();
  process.exit(1);
});
