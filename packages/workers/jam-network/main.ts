import type { Epoch } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import type { AuthorshipComms } from "@typeberry/comms-authorship-network";
import { parseBootnode } from "@typeberry/config-node";
import { ed25519, initWasm } from "@typeberry/crypto";
import { setup } from "@typeberry/jamnp-s";
import { Logger } from "@typeberry/logger";
import { type TicketValidator, type ValidatedTicket, ValidationError } from "@typeberry/ticket-pool";
import { Result } from "@typeberry/utils";
import type { WorkerConfig } from "@typeberry/workers-api";
import type { NetworkingConfig, NetworkingInternal } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "net");

/**
 * JAM networking worker.
 *
 * The worker is responsible for setting up the UDP networking socket
 * (using `typeberry/networking` package) and adding relevant JAMNP-s
 * stream handlers.
 */
export async function main(
  config: WorkerConfig<NetworkingConfig>,
  comms: NetworkingInternal,
  authorshipComms: AuthorshipComms,
) {
  await initWasm();
  logger.trace`🛜 Network starting`;

  // Await the configuration object
  const chainSpec = config.chainSpec;
  const db = config.openDatabase();
  const blocks = db.getBlocksDb();
  const params = config.workerParams;
  const key = await ed25519.privateKey(params.key);

  logger.info`🛜 Listening at ${params.host}:${params.port}`;
  const network = await setup(
    {
      host: params.host,
      port: params.port,
    },
    params.genesisHeaderHash,
    key,
    params.bootnodes.map(parseBootnode).filter((node) => node.host !== params.host || node.port !== params.port),
    chainSpec,
    blocks,
    async (blocks) => await comms.sendBlocks(blocks),
  );

  const waitForFinish = new Promise<void>((resolve) => {
    comms.setOnFinish(async () => resolve());
  });

  // send notifications about imported headers
  comms.setOnNewHeader(async (header) => {
    network.syncTask.broadcastHeader(header);
  });

  // Handle tickets received directly from block-authorship (bypasses main thread)
  authorshipComms.setOnTickets(async ({ epochIndex, tickets }) => {
    logger.log`Received ${tickets.length} tickets directly from block-authorship for epoch ${epochIndex}`;
    for (const ticket of tickets) {
      network.ticketTask.addTicket(epochIndex, ticket);
    }
  });

  // Authorship pushes the authoritative ticket pool on epoch boundaries; networking
  // replaces its redistribution pool wholesale so the two sides cannot drift.
  authorshipComms.setOnReplaceTicketPool(async ({ epochIndex, tickets }) => {
    logger.log`Replacing redistribution pool from block-authorship for epoch ${epochIndex} (${tickets.length} tickets)`;
    network.ticketTask.replacePool(epochIndex, tickets);
  });

  // Validator that hands a received ticket to block-authorship over IPC and waits
  // for an accept/reject decision. The wire protocol stays a simple bool; the
  // computed id stays inside authorship (it owns the verified pool).
  const ipcValidator: TicketValidator = {
    validate: async (epochIndex: Epoch, ticket: SignedTicket): Promise<Result<ValidatedTicket, ValidationError>> => {
      const ok = await authorshipComms.sendReceivedTickets({ epochIndex, ticket });
      if (!ok) {
        return Result.error(ValidationError.InvalidProof, () => "authorship rejected the ticket");
      }
      return Result.ok({ id: null });
    },
  };
  network.ticketTask.setTicketValidator(ipcValidator);

  await network.network.start();

  // stop the network when the worker is finishing.
  await waitForFinish;
  await network.network.stop();
  await db.close();

  logger.info`🛜 Network worker finished. Closing channel.`;
}
