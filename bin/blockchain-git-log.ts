import { promises as fs } from "fs";
import github from "@actions/github";
import { ApiPromise, WsProvider, Keyring } from "@polkadot/api";
import { ExtrinsicStatus, Hash } from "@polkadot/types/interfaces";
import { PushEvent } from "@octokit/webhooks-types";

type TransactionPayload = [
  string,
  string | null,
  number,
  string[],
  Hash | null
];

interface LogEntry {
  payload: TransactionPayload;
  block: Hash | null; // @todo remove null
  status: ExtrinsicStatus | null; // @todo remove null
}

const DRY = true;
const LOG_PATH = "../logs/commit-hash-to-blockchain.log.json";

async function main() {
  const log: LogEntry[] = [];

  try {
    log.push(...require(LOG_PATH));
  } catch {
    console.log("Previous log not found.");
  }

  const eventPayload = github.context.payload as PushEvent;
  const commitIds = eventPayload.commits.map((commit) => commit.id);

  const transactionPayload: TransactionPayload = [
    eventPayload.repository.name,
    eventPayload.base_ref,
    Date.now(),
    commitIds,
    log.at(-1)?.block || null,
  ];

  if (DRY) {
    const logEntry: LogEntry = {
      payload: transactionPayload,
      status: null,
      block: null,
    };

    log.push(logEntry);

    await fs.writeFile(LOG_PATH, JSON.stringify(log));
  }

  // Connect to the local Substrate node
  const wsProvider = new WsProvider("ws://127.0.0.1:9944");
  const api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: "sr25519" });
  const alice = keyring.addFromUri("//Alice", { name: "Alice default" });

  // Create a remark transaction
  const remark = api.tx.system.remark(JSON.stringify(transactionPayload));

  // Sign and send the transaction
  const unsub = await remark.signAndSend(alice, (result) => {
    console.log(`Transaction status: ${result.status}`);

    if (result.status.isInBlock) {
      console.log(
        `Transaction included at blockHash ${result.status.asInBlock}`
      );
      //   unsub();
      //   api.disconnect();
    } else if (result.status.isFinalized) {
      console.log(
        `Transaction finalized at blockHash ${result.status.asFinalized}`
      );
      unsub();
      api.disconnect();
    }
  });
}

main().catch(console.error);
