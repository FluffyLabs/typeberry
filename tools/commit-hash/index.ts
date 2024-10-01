import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as github from "@actions/github";
import type { PushEvent } from "@octokit/webhooks-types";
// @ts-ignore ECMAScript module being incompatible with CommonJS.
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { Logger } from "@typeberry/logger";

const logger = Logger.new(__filename, "commit-hash");

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

if (!LOG_FILENAME || !AUTH) {
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

async function main() {
  const log: LogEntry[] = [];

  try {
    log.push(...require(path.relative(__dirname, LOG_FILENAME)));
    logger.log("Previous log found. Appending.");
  } catch (e) {
    logger.log("Previous log not found. Starting a new one.");
  }

  const eventPayload = github.context.payload as PushEvent;
  const previousBlockHash = log.filter((logEntry) => !logEntry.failed).pop()?.block || "";
  const transactionPayload: TransactionPayload = [
    eventPayload.repository.name,
    github.context.ref,
    Date.now(),
    getPendingCommitIds(log, eventPayload),
    previousBlockHash,
  ];

  const wsProvider = new WsProvider("wss://kusama-asset-hub-rpc.polkadot.io");
  const api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: "sr25519" });
  const pair = keyring.addFromUri(AUTH);

  const remark = api.tx.system.remark(JSON.stringify(transactionPayload));

  try {
    logger.log("Submitting...");

    const unsub = await remark.signAndSend(pair, async ({ status, dispatchError }) => {
      logger.log(`Transaction status: ${status.type}`);

      if (status.isInBlock) {
        logger.log(`Success. Block hash: ${status.asInBlock.toString()}`);

        log.push({
          payload: transactionPayload,
          status: status.type,
          block: status.asInBlock.toString(),
          failed: false,
        });

        await writeLog(log);

        unsub();
        await api.disconnect();
      } else if (dispatchError) {
        await handleError(log, transactionPayload, dispatchError.toString());

        unsub();
        await api.disconnect();
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      await handleError(log, transactionPayload, error.toString());
    }
    await api.disconnect();
  }
}

main();
