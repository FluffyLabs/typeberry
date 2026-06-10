import os from "node:os";
import { type SignedTicket, tryAsEpoch } from "@typeberry/block";
import { HashSet } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import type { State } from "@typeberry/state";
import { measure } from "@typeberry/utils";
import type { ValidatorKey } from "./ticket-generator.js";
import { TicketGeneratorPool } from "./worker-pool.js";

/**
 * Extra validators to generate tickets for, beyond the minimum needed to fill the
 * accumulator. Filling requires `epochLength` distinct valid tickets; each validator
 * yields `ticketsPerValidator`. The margin guards against a few tickets failing to
 * land (extra tickets are simply dropped by the accumulator).
 */
const TICKET_GENERATION_VALIDATOR_MARGIN = 8;
/** Leave this many cores for the main thread, importer, network and the OS. */
const TICKET_POOL_RESERVED_CORES = 4;
/** Hard cap on ticket-generation worker threads. */
const TICKET_POOL_MAX_WORKERS = 8;

const logger = Logger.new(import.meta.filename, "tickets");
const measureTicketGen = measure("ticket:gen");

/** Number of worker threads to use for parallel ticket generation. */
function ticketPoolWorkerCount(validators: number): number {
  const cores = os.availableParallelism?.() ?? os.cpus().length;
  const availableCores = Math.min(cores - TICKET_POOL_RESERVED_CORES, TICKET_POOL_MAX_WORKERS);
  // never reserve more cores than we have validators (makes no sense)
  const requiredCores = Math.min(validators, availableCores);
  return Math.max(1, requiredCores);
}

export type TicketGeneratorOptions = {
  useWorkerPool: boolean;
};

export class TicketGenerator {
  static async new(chainSpec: ChainSpec, keys: ValidatorKey[]) {
    const pool = await TicketGeneratorPool.create(ticketPoolWorkerCount(keys.length));
    return new TicketGenerator(chainSpec, keys, pool);
  }

  private constructor(
    private readonly chainSpec: ChainSpec,
    private readonly keys: ValidatorKey[],
    private readonly pool: TicketGeneratorPool,
  ) {}

  async generateTickets(state: State, isEpochStart: boolean, onTickets: (tickets: SignedTicket[]) => Promise<void>) {
    // Pick the right entropy and validator set
    const validators = isEpochStart ? state.designatedValidatorData : state.nextValidatorData;
    const entropy = isEpochStart ? state.entropy[1] : state.entropy[2];

    const epoch = tryAsEpoch(Math.floor(state.timeslot / this.chainSpec.epochLength));
    const ringKeys = validators.map((d) => d.bandersnatch);
    const nextKeySet = HashSet.from(ringKeys);
    const validatorKeys = this.keys.filter((k) => nextKeySet.has(k.public));

    // Generate just enough validators to fill the accumulator, plus a margin.
    const needed =
      Math.ceil(this.chainSpec.epochLength / this.chainSpec.ticketsPerValidator) + TICKET_GENERATION_VALIDATOR_MARGIN;
    const selected = validatorKeys.slice(0, Math.min(validatorKeys.length, needed));

    const ticketGen = measureTicketGen();
    logger.info`🎫 [E${epoch}] generating tickets for ${selected.length} validators across ${this.pool.workerCount} worker threads…`;

    try {
      await this.pool.generate(ringKeys, selected, entropy, this.chainSpec.ticketsPerValidator, onTickets);
      logger.info`🎫 [E${epoch}] ${ticketGen}`;
    } catch (e) {
      logger.warn`🎫 [E${epoch}] ticket generation failed: ${e}`;
    }
  }
}
