import { type ChildProcess, spawn } from "node:child_process";
import { test } from "node:test";
import { promises, setTimeout } from "node:timers";
import { Logger } from "@typeberry/logger";

const TEST_TIMEOUT = 60_000;
const SHUTDOWN_GRACE_PERIOD = 5_000;
const TARGET_BLOCK = 6;

const logger = Logger.new(import.meta.filename, "jam:e2e");

test("JAM Node Startup E2E", { timeout: TEST_TIMEOUT }, async () => {
  let jamProcess: ChildProcess | null = null;
  try {
    jamProcess = await start();

    // wait for specific output on the console
    await new Promise((resolve, reject) => {
      jamProcess?.on("error", (err) => {
        reject(`Failed to start process: ${err.message}`);
      });
      jamProcess?.on("exit", (code, signal) => {
        reject(`Process exited (code: ${code}, signal: ${signal})`);
      });

      jamProcess?.stdout?.on("data", (data: Buffer) => {
        const output = data.toString();
        logger.info(output);

        const bestBlockPattern = /🧊 Best block:.+#(\d+)/;
        const match = bestBlockPattern.exec(output);
        if (match !== null) {
          const blockNum = Number.parseInt(match[1]);
          logger.info(`Got block ${blockNum}`);
          if (blockNum >= TARGET_BLOCK) {
            resolve("Finished successfuly.");
          }
        }
      });
    });
  } finally {
    await terminate(jamProcess);
  }
});

async function terminate(jamProcess: ChildProcess | null) {
  if (jamProcess !== null && !jamProcess.killed) {
    jamProcess.kill("SIGINT");
    await promises.setTimeout(SHUTDOWN_GRACE_PERIOD);
    if (!jamProcess.killed) {
      logger.error("Process shutdown timing out. Killing");
      jamProcess.kill("SIGKILL");
    }
  }
}

async function start() {
  const spawned = spawn("npm", ["start", "dev", "1"], {
    cwd: process.cwd(),
    shell: true,
  });
  const timeout = setTimeout(() => {
    logger.error("Test timing out, terminating the process.");
    terminate(spawned);
  }, TEST_TIMEOUT);
  spawned.on("exit", () => {
    clearTimeout(timeout);
  });
  return spawned;
}
