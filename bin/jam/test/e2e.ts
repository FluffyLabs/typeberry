import { type ChildProcess, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { test } from "node:test";
import { promises, setTimeout } from "node:timers";
import { tinyChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";

const TEST_TIMEOUT = 60_000;
const SHUTDOWN_GRACE_PERIOD = 5_000;
const TARGET_BLOCK = 6;
const LOG_TAIL_LINES = 40;

const logger = Logger.new(import.meta.filename, "jam:e2e");

const bestBlockPattern = /🧊 Best:.+#(\d+)/;

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

test("JAM Node dev blocks with Fjall", { timeout: TEST_TIMEOUT }, async () => {
  const dbPath = "./test-db";
  let jamProcess: ChildProcess | null = null;
  try {
    // enable persistent storage (fjall by default)
    jamProcess = await start({ devIndex: "all", args: [`--config=.database_base_path="${dbPath}"`] });

    // wait for specific output on the console
    await listenForBestBlocks("dev-fjall", jamProcess, (blockNum) => blockNum > TARGET_BLOCK);
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

test("JAM Node ticket distribution with Fjall and worker threads", { timeout: 120_000 }, async () => {
  const VALIDATOR_COUNT = tinyChainSpec.validatorsCount;
  const TICKETS_PER_VALIDATOR = tinyChainSpec.ticketsPerValidator;
  const TICKET_TEST_TIMEOUT = 110_000; // Shorter than test timeout (120s) to allow cleanup
  const processes: ChildProcess[] = [];
  const testDbParentPath = "./test-db-e2e-ticket-distribution";

  try {
    // Start 6 individual validator nodes, each with its own persistent fjall database and worker threads.
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

    // Collect addTicket logs from each validator until the ticket pool is complete.
    const validatorLogPromises = processes.map((proc, i) =>
      collectTicketLogs(`validator-${i}`, proc, EXPECTED_TICKETS),
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

    logger.info`All ${VALIDATOR_COUNT} validators have at least ${EXPECTED_TICKETS} tickets`;
  } finally {
    await Promise.all(processes.map((proc) => terminate(proc)));
    // clean up all test databases at once by removing parent folder
    rmSync(testDbParentPath, { recursive: true, force: true });
  }
});

/**
 * Collects ticket logs until the validator has observed the expected ticket count.
 * Returns array of matched log lines.
 */
async function collectTicketLogs(prefix: string, proc: ChildProcess, expectedTickets: number): Promise<string[]> {
  const blockPattern = /🧊 Best:.+#(\d+)/;
  const matchedLines: string[] = [];
  const recentLines: string[] = [];
  let currentBlock = 0;
  let maxTickets = 0;

  return new Promise((resolve, reject) => {
    // Buffer for incomplete lines across chunks
    let remainder = "";

    const handleOutput = (data: Buffer) => {
      const output = remainder + data.toString();
      const lines = output.split("\n");

      // Last element is incomplete line (or empty if output ends with \n)
      remainder = lines.pop() ?? "";

      for (const line of lines) {
        recentLines.push(line);
        if (recentLines.length > LOG_TAIL_LINES) {
          recentLines.shift();
        }

        // Check for new blocks
        const blockMatch = blockPattern.exec(line);
        if (blockMatch !== null) {
          currentBlock = Number.parseInt(blockMatch[1], 10);
        }

        const ticketCount = parseTicketCount(line);
        if (ticketCount !== null) {
          matchedLines.push(line);
          maxTickets = Math.max(maxTickets, ticketCount);
        }
      }

      // Resolve as soon as ticket distribution has completed. Waiting for a
      // later block height makes this test depend on multi-author chain
      // convergence, even though the assertion is only about ticket gossip.
      if (maxTickets >= expectedTickets) {
        // Note: remainder is intentionally NOT flushed - it's an incomplete fragment
        // Only fully-terminated lines (processed in the loop) are counted
        resolve(matchedLines);
      }
    };

    proc?.on("error", (err) => {
      reject(`(${prefix}) Failed to start process: ${err.message}`);
    });

    proc?.on("close", (code) => {
      if (maxTickets >= expectedTickets) {
        resolve(matchedLines);
        return;
      }
      if (code !== 0 && code !== null) {
        reject(
          new Error(
            `(${prefix}) Process exited with code ${code} at block ${currentBlock}\n${formatLogTail(recentLines)}`,
          ),
        );
      } else {
        reject(new Error(`(${prefix}) Process exited early at block ${currentBlock}\n${formatLogTail(recentLines)}`));
      }
    });

    // Capture both stdout and stderr (logs might go to either)
    proc?.stdout?.on("data", handleOutput);
    proc?.stderr?.on("data", handleOutput);
  });
}

function formatLogTail(lines: string[]): string {
  if (lines.length === 0) {
    return "No process output captured.";
  }
  return [`Last ${lines.length} process output lines:`, ...lines].join("\n");
}

/**
 * Extracts ticket count from addTicket log lines.
 * Returns the maximum "total" value found (represents final ticket count).
 */
function extractTicketCount(logLines: string[]): number {
  let maxTickets = 0;

  for (const line of logLines) {
    const count = parseTicketCount(line);
    if (count !== null && count > maxTickets) {
      maxTickets = count;
    }
  }

  return maxTickets;
}

function parseTicketCount(line: string): number | null {
  const ticketPattern = /\[addTicket\] Added ticket for epoch (\d+), total: (\d+)/;
  const match = ticketPattern.exec(line);
  if (match === null) {
    return null;
  }
  return Number.parseInt(match[2], 10);
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
  const devArgs = options.devIndex === null ? ["--config=dev", "--name=test"] : ["dev", `${options.devIndex}`];
  const args = options.args !== undefined ? [...devArgs, ...options.args] : devArgs;
  const processTimeout = options.timeout ?? TEST_TIMEOUT;
  const spawned = spawn("npm", ["start", "--", ...args], {
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
