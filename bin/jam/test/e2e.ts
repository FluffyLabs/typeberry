import { type ChildProcess, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { promises, setTimeout } from "node:timers";
import { tinyChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";

const TEST_TIMEOUT = 60_000;
const SHUTDOWN_GRACE_PERIOD = 5_000;
const TARGET_BLOCK = 6;

const logger = Logger.new(import.meta.filename, "jam:e2e");

const bestBlockPattern = /🧊 Best block:.+#(\d+)/;

test("JAM Node dev blocks with In Memory", { timeout: TEST_TIMEOUT }, async () => {
  let jamProcess: ChildProcess | null = null;
  try {
    // enable In Memory storage
    jamProcess = await start();

    // wait for specific output on the console
    await listenForBestBlocks("dev", jamProcess, (blockNum) => blockNum > TARGET_BLOCK);
  } finally {
    await terminate(jamProcess);
  }
});

test("JAM Node dev blocks with LMDB", { timeout: TEST_TIMEOUT }, async () => {
  const dbPath = "./test-db";
  let jamProcess: ChildProcess | null = null;
  try {
    // enable LMDB storage
    jamProcess = await start({ devIndex: "all", args: [`--config=.database_base_path="${dbPath}"`] });

    // wait for specific output on the console
    await listenForBestBlocks("dev-lmdb", jamProcess, (blockNum) => blockNum > TARGET_BLOCK);
  } finally {
    await terminate(jamProcess);
    // clean up test database
    rmSync(dbPath, { recursive: true, force: true });
  }
});

test("JAM Node network connection", { timeout: TEST_TIMEOUT }, async () => {
  let jamProcess1: ChildProcess | null = null;
  let jamProcess2: ChildProcess | null = null;
  try {
    jamProcess1 = await start({ devIndex: "all" });
    // introducing some timeout, due to networking issues when started at the same time
    await promises.setTimeout(1_000);
    jamProcess2 = await start({ devIndex: null });

    // wait for the dev-mode one to start
    const proc1 = listenForBestBlocks("dev-all", jamProcess1, () => true);

    // wait for specific output on the console of the second node (should sync)
    const proc2 = listenForBestBlocks("test", jamProcess2, (blockNum) => blockNum > TARGET_BLOCK);

    await proc1;
    await proc2;
  } finally {
    await terminate(jamProcess1);
    await terminate(jamProcess2);
  }
});

test("JAM Node ticket distribution with LMDB and worker threads", { timeout: 120_000 }, async () => {
  const VALIDATOR_COUNT = tinyChainSpec.validatorsCount;
  const TICKETS_PER_VALIDATOR = tinyChainSpec.ticketsPerValidator;
  const EPOCH_LENGTH = tinyChainSpec.epochLength;
  const TICKET_TEST_TIMEOUT = 110_000; // Shorter than test timeout (120s) to allow cleanup
  const processes: ChildProcess[] = [];
  const testDbParentPath = "./test-db-e2e-ticket-distribution";

  try {
    // Start 6 individual validator nodes, each with its own LMDB database and worker threads.
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const dbPath = `${testDbParentPath}/validator-${i}`;
      const proc = await start({
        devIndex: i,
        args: [`--config=.database_base_path="${dbPath}"`],
        timeout: TICKET_TEST_TIMEOUT,
      });
      processes.push(proc);
      // stagger startup to avoid networking issues
      if (i < VALIDATOR_COUNT - 1) {
        await promises.setTimeout(1_000);
      }
    }

    // Tiny chain spec: 6 validators, 3 tickets per validator = 18 tickets per epoch.
    // Each validator should have all 18 tickets (their own 3 + 15 from peers via network)
    const EXPECTED_TICKETS = VALIDATOR_COUNT * TICKETS_PER_VALIDATOR;

    // Collect addTicket logs from each validator until epoch completes
    const validatorLogPromises = processes.map((proc, i) =>
      collectLogsUntilBlock(`validator-${i}`, proc, /\[addTicket\] Added ticket for epoch/, EPOCH_LENGTH),
    );

    const validatorLogs = await Promise.all(validatorLogPromises);

    // Verify each validator has expected number of tickets
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const ticketCount = extractTicketCount(validatorLogs[i]);
      if (ticketCount < EXPECTED_TICKETS) {
        throw new Error(`Validator ${i} has ${ticketCount} tickets, expected at least ${EXPECTED_TICKETS}`);
      }
      logger.info`Validator ${i} has ${ticketCount} tickets`;
    }

    logger.info`All ${VALIDATOR_COUNT} validators have at least ${EXPECTED_TICKETS} tickets after ${EPOCH_LENGTH} blocks`;
  } finally {
    await Promise.all(processes.map((proc) => terminate(proc)));
    // clean up all test databases at once by removing parent folder
    rmSync(testDbParentPath, { recursive: true, force: true });
  }
});

/**
 * Collects log lines matching a pattern until target block is reached.
 * Returns array of matched log lines.
 */
async function collectLogsUntilBlock(
  prefix: string,
  proc: ChildProcess,
  pattern: RegExp,
  targetBlock: number,
): Promise<string[]> {
  const blockPattern = /🧊 Best block:.+#(\d+)/;
  const matchedLines: string[] = [];
  let currentBlock = 0;

  return new Promise((resolve, reject) => {
    // Buffer for incomplete lines across chunks
    let remainder = "";

    const handleOutput = (data: Buffer) => {
      const output = remainder + data.toString();
      const lines = output.split("\n");

      // Last element is incomplete line (or empty if output ends with \n)
      remainder = lines.pop() ?? "";

      for (const line of lines) {
        // Check for new blocks
        const blockMatch = blockPattern.exec(line);
        if (blockMatch !== null) {
          currentBlock = Number.parseInt(blockMatch[1], 10);
        }

        // Collect lines matching the pattern
        if (pattern.test(line)) {
          matchedLines.push(line);
        }
      }

      // Resolve when target block is reached
      if (currentBlock >= targetBlock) {
        // Note: remainder is intentionally NOT flushed - it's an incomplete fragment
        // Only fully-terminated lines (processed in the loop) are counted
        resolve(matchedLines);
      }
    };

    proc?.on("error", (err) => {
      reject(`(${prefix}) Failed to start process: ${err.message}`);
    });

    proc?.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        reject(`(${prefix}) Process exited with code ${code}`);
      } else if (currentBlock >= targetBlock) {
        resolve(matchedLines);
      } else {
        reject(`(${prefix}) Process exited early at block ${currentBlock}`);
      }
    });

    // Capture both stdout and stderr (logs might go to either)
    proc?.stdout?.on("data", handleOutput);
    proc?.stderr?.on("data", handleOutput);
  });
}

/**
 * Extracts ticket count from addTicket log lines.
 * Returns the maximum "total" value found (represents final ticket count).
 */
function extractTicketCount(logLines: string[]): number {
  const ticketPattern = /\[addTicket\] Added ticket for epoch (\d+), total: (\d+)/;
  let maxTickets = 0;

  for (const line of logLines) {
    const match = ticketPattern.exec(line);
    if (match !== null) {
      const count = Number.parseInt(match[2], 10);
      if (count > maxTickets) {
        maxTickets = count;
      }
    }
  }

  return maxTickets;
}

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

async function start(
  options: { devIndex: number | "all" | null; args?: string[]; timeout?: number } = { devIndex: "all" },
) {
  const devArgs = options.devIndex === null ? ["--", "--config=dev", "--name=test"] : ["dev", `${options.devIndex}`];
  const args = options.args !== undefined ? [...devArgs, ...options.args] : devArgs;
  const processTimeout = options.timeout ?? TEST_TIMEOUT;
  const spawned = spawn("npm", ["start", ...args], {
    cwd: process.cwd(),
  });
  const timeout = setTimeout(() => {
    logger.error`Test timing out, terminating the process.`;
    terminate(spawned);
  }, processTimeout);
  spawned.on("exit", () => {
    clearTimeout(timeout);
  });
  return spawned;
}
