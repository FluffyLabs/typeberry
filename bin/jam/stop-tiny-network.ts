#!/usr/bin/env tsx
// biome-ignore-all lint/suspicious/noConsole: bin file
// Stop the tiny network of JAM nodes

import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";

const LOGS_DIR = "./logs";

async function main() {
  const pidFile = join(LOGS_DIR, ".pids");

  try {
    const content = await readFile(pidFile, "utf-8");
    const pids = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => Number.parseInt(line.trim(), 10));

    console.log(`Stopping ${pids.length} nodes...`);

    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
        console.log(`  Stopped node with PID: ${pid}`);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ESRCH") {
          console.log(`  Node with PID ${pid} is not running`);
        } else {
          console.error(`  Failed to stop node with PID ${pid}:`, err);
        }
      }
    }

    // Clean up PID file
    await unlink(pidFile);

    console.log("");
    console.log("All nodes stopped.");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("No running network found (PID file does not exist).");
      console.log(`Expected file: ${pidFile}`);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Error stopping network:", err);
  process.exit(1);
});
