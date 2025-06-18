import * as fs from "node:fs/promises";
import type { PushEvent } from "@octokit/webhooks-types";
import { ksm } from "@polkadot-api/descriptors";
import { createClient, Binary } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { getPolkadotSigner } from "polkadot-api/signer";
import { sr25519Sign, sr25519PairFromSeed, cryptoWaitReady } from "@polkadot/util-crypto";
import { Logger, withTimestamps } from "@typeberry/logger";
const logger = withTimestamps(Logger.new(import.meta.filename, "commit-hash"));

type TransactionPayload = [
  string, // repo name
  string, // ref/branch name
  number, // timestamp
  string[], // commit ids
  string | null, // previous block hash
];
const COMMIT_IDS_INDEX = 3;

interface LogEntry {
  payload: TransactionPayload;
  block: string;
  status: string;
  failed: boolean;
}

const LOG_FILENAME = process.env.LOG_FILENAME as string;
const AUTH = process.env.COMMIT_KEY_SECRET as string;

if (LOG_FILENAME === undefined || AUTH === undefined) {
  logger.error("Missing LOG_FILENAME or COMMIT_KEY_SECRET env variables");
  throw new Error("Missing LOG_FILENAME or COMMIT_KEY_SECRET env variables");
}

function getPendingCommitIds(log: LogEntry[], eventPayload: PushEvent): string[] {
  const commitIds = [...eventPayload.commits.map((commit) => commit.id)];

  for (let i = log.length - 1; i >= 0; i--) {
    if (!log[i].failed) {
      break;
    }
    commitIds.unshift(...log[i].payload[COMMIT_IDS_INDEX]);
  }

  return commitIds;
}

async function writeLog(log: LogEntry[]) {
  try {
    await fs.writeFile(LOG_FILENAME, JSON.stringify(log, null, 2));
    logger.log("New log written.");
  } catch (e) {
    logger.error(JSON.stringify(e, null, 2));
  }
}

async function readLog(): Promise<LogEntry[]> {
  try {
    const file = await fs.readFile(LOG_FILENAME, "utf8");
    const jsonFile = JSON.parse(file);
    if (Array.isArray(jsonFile)) {
      return jsonFile;
    }
    return [];
  } catch {
    return [];
  }
}

async function handleError(log: LogEntry[], transactionPayload: TransactionPayload, error: string) {
  log.push({
    payload: transactionPayload,
    status: error,
    block: "",
    failed: true,
  });

  await writeLog(log);

  logger.error(error);
  process.exit(1);
}

function readRequiredEnv(val: string | undefined, name: string) {
  if (val === undefined) {
    throw new Error(`Required variable: ${name} is not populated!`);
  }
  return val;
}

async function readEventPayload() {
  const ghEventPath = readRequiredEnv(process.env.GITHUB_EVENT_PATH, "GITHUB_EVENT_PATH");
  const file = await fs.readFile(ghEventPath, { encoding: "utf8" });
  return JSON.parse(file) as PushEvent;
}

async function main() {
  const log: LogEntry[] = await readLog();

  if (log.length > 0) {
    logger.info("Found previous log. Appending.");
  } else {
    logger.error("Previous log not found or invalid. Starting a new one.");
  }

  const eventPayload = await readEventPayload();
  const githubRef = readRequiredEnv(process.env.GITHUB_REF, "GITHUB_REF");
  const previousBlockHash = log.filter((logEntry) => !logEntry.failed).pop()?.block ?? "";
  const transactionPayload: TransactionPayload = [
    eventPayload.repository.name,
    githubRef,
    Date.now(),
    getPendingCommitIds(log, eventPayload),
    previousBlockHash,
  ];

  await cryptoWaitReady();

  const client = createClient(getWsProvider("wss://kusama-asset-hub-rpc.polkadot.io"));
  const api = client.getTypedApi(ksm);
  const keypair = sr25519PairFromSeed(AUTH);
  const signer = getPolkadotSigner(keypair.publicKey, "Sr25519", (input) => sr25519Sign(input, keypair));

  const remark = api.tx.System.remark({ remark: Binary.fromText(JSON.stringify(transactionPayload)) });

  logger.log("Submitting...");

  remark.signSubmitAndWatch(signer).subscribe({
    next: (event) => {
      logger.log(`Transaction status: ${event.type}`);
      if (event.type === "txBestBlocksState") {
        log.push({
          payload: transactionPayload,
          status: event.type,
          block: event.txHash,
          failed: false,
        });

        writeLog(log);

        logger.log("Transaction is now in a best block:");
        logger.log(`https://assethub-kusama.subscan.io/extrinsic/${event.txHash}`);
      }
    },
    error: (error) => {
      handleError(log, transactionPayload, error.toString());
    },
    complete: () => {
      client.destroy();
    },
  });
}

main();
