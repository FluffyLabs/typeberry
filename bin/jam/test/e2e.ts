import { type ChildProcess, spawn } from "node:child_process";
import { test } from "node:test";
import { promises, setTimeout } from "node:timers";
import { Logger } from "@typeberry/logger";

const TEST_TIMEOUT = 60_000;
const SHUTDOWN_GRACE_PERIOD = 5_000;
const TARGET_BLOCK = 6;

const logger = Logger.new(import.meta.filename, "jam:e2e");

const bestBlockPattern = /🧊 Best block:.+#(\d+)/;

test("JAM Node dev blocks", { timeout: TEST_TIMEOUT }, async () => {
  let jamProcess: ChildProcess | null = null;
  try {
    jamProcess = await start();

    // wait for specific output on the console
    await listenForBestBlocks("dev", jamProcess, (blockNum) => blockNum > TARGET_BLOCK);
  } finally {
    await terminate(jamProcess);
  }
});

test("JAM Node network connection", { timeout: TEST_TIMEOUT }, async () => {
  let jamProcess1: ChildProcess | null = null;
  let jamProcess2: ChildProcess | null = null;
  try {
    jamProcess1 = await start({ devIndex: 2 });
    // introducing some timeout, due to networking issues when started at the same time
    await promises.setTimeout(1_000);
    jamProcess2 = await start({ devIndex: null });

    // wait for the dev-mode one to start
    const proc1 = listenForBestBlocks("dev-2", jamProcess1, () => true);

    // wait for specific output on the console of the second node (should sync)
    const proc2 = listenForBestBlocks("test", jamProcess2, (blockNum) => blockNum > TARGET_BLOCK);

    await proc1;
    await proc2;
  } finally {
    await terminate(jamProcess1);
    await terminate(jamProcess2);
  }
});

async function listenForBestBlocks(prefix: string, proc: ChildProcess, check: (blockNum: number) => boolean) {
  return new Promise((resolve, reject) => {
    proc?.on("error", (err) => {
      reject(`(${prefix}) Failed to start process: ${err.message}`);
    });
    proc?.on("exit", (code, signal) => {
      reject(`(${prefix}) Process exited (code: ${code}, signal: ${signal})`);
    });
    proc?.stderr?.on("data", (data: Buffer) => {
      logger.error`(${prefix}) ${data.toString()}`;
    });

    proc?.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      logger.info`(${prefix}) ${output}`;

      const match = bestBlockPattern.exec(output);
      if (match !== null) {
        const blockNum = Number.parseInt(match[1], 10);
        logger.info`(${prefix}) Got block ${blockNum}`;
        if (check(blockNum)) {
          resolve(`(${prefix}) Finished successfuly.`);
        }
      }
    });
  });
}

async function terminate(jamProcess: ChildProcess | null) {
  if (jamProcess !== null && !jamProcess.killed) {
    logger.error`Terminating process.`;
    const grace = promises.setTimeout(SHUTDOWN_GRACE_PERIOD);
    jamProcess.kill("SIGINT");
    jamProcess.stdin?.end();
    jamProcess.stdout?.destroy();
    jamProcess.stderr?.destroy();
    await grace;
    logger.error`Process shutdown timing out. Killing`;
    jamProcess.kill("SIGKILL");
  }
}

async function start(options: { devIndex: number | null } = { devIndex: 1 }) {
  const args = options.devIndex === null ? ["--", "--config=dev", "--name=test"] : ["dev", `${options.devIndex}`];
  const spawned = spawn("npm", ["start", ...args], {
    cwd: process.cwd(),
  });
  const timeout = setTimeout(() => {
    logger.error`Test timing out, terminating the process.`;
    terminate(spawned);
  }, TEST_TIMEOUT);
  spawned.on("exit", () => {
    clearTimeout(timeout);
  });
  return spawned;
}
