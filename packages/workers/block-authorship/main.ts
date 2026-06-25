import { setTimeout } from "node:timers/promises";
import {
  type Epoch,
  type PerValidator,
  type SignedTicket,
  type TimeSlot,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import type { NetworkingComms } from "@typeberry/comms-authorship-network";
import type { ChainSpec } from "@typeberry/config";
import { type BandersnatchKey, initWasm } from "@typeberry/crypto";
import { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU64, type U32 } from "@typeberry/numbers";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import type { ValidatorData } from "@typeberry/state";
import { VerifiedTicketPool } from "@typeberry/ticket-pool";
import type { WorkerConfig } from "@typeberry/workers-api";
import { BlockGenerator } from "./block-generator.js";
import { type EpochData, EpochTracker } from "./epoch-tracker.js";
import type { BlockAuthorshipConfig, GeneratorInternal } from "./protocol.js";
import { TicketGenerator } from "./ticket-generator/index.js";
import { BandersnatchTicketValidator } from "./ticket-validator.js";

const logger = Logger.new(import.meta.filename, "author");

type Config = WorkerConfig<BlockAuthorshipConfig>;

/**
 * The `BlockAuthorship` should create new blocks and send them as signals to the main thread.
 */

export async function main(
  config: Config,
  comms: GeneratorInternal,
  networkingComms: NetworkingComms,
  ready: () => void = () => {},
) {
  await initWasm();
  logger.info`🎁 Block Authorship running`;
  const chainSpec = config.chainSpec;
  const db = await config.openDatabase();
  const blocks = db.getBlocksDb();
  const states = db.getStatesDb();

  const getBestState = () => {
    const state = states.getState(blocks.getBestHeaderHash());
    if (state === null) {
      throw new Error("Authorship: State for the best block is missing. Terminating.");
    }
    return state;
  };

  const blake2bHasher = await Blake2b.createHasher();
  const bandersnatch = await BandernsatchWasm.new();
  const keccakHasher = await keccak.KeccakHasher.create();

  const epochTracker = await EpochTracker.new(chainSpec, bandersnatch, blake2bHasher, config.workerParams.keys);

  logger.info`👛 Authoring with: ${epochTracker.authoring.getBandersnatchPublicKeys().map((bandersnatchPublic, index) => `\n ${index}: ${bandersnatchPublic}`)}`;

  const generator = BlockGenerator.new({
    chainSpec,
    bandersnatch,
    keccakHasher,
    blake2b: blake2bHasher,
    blocks,
    states,
  });

  // Verified tickets for the next epoch, keyed by entropy hash (ticket id).
  const verifiedPool = VerifiedTicketPool.new();
  const ticketValidator = BandersnatchTicketValidator.new(chainSpec, bandersnatch, getBestState);
  const keys = epochTracker.authoring.getValidatorKeys().map((x) => ({
    public: x.bandersnatchPublic,
    secret: x.bandersnatchSecret,
  }));
  const ticketGenerator = await TicketGenerator.new(chainSpec, keys);

  // handling incoming tickets
  const onEpochTickets = async (epochIndex: Epoch, tickets: SignedTicket[], source: string) => {
    logger.log`[E${epochIndex}] Received (${tickets.length}) tickets from ${source}`;
    const result = await ticketValidator.validate(epochIndex, tickets);
    // add to our pool as well
    if (result.isOk) {
      verifiedPool.add(epochIndex, result.ok);
    }
    return result.isOk;
  };
  // Receive tickets from networking.
  networkingComms.setOnReceivedTickets(async ({ epochIndex, tickets }) => {
    return await onEpochTickets(epochIndex, tickets, "network");
  });

  const state = getBestState();
  const timeSlotHandler = TimeSlotHandler.new(config.workerParams.isFastForward, chainSpec, state.timeslot);
  // per-epoch cached data
  let epochData: EpochData | null = null;

  // Generate blocks until the close signal is received.
  let isFinished = false;
  comms.setOnFinish(async () => {
    isFinished = true;
  });

  let ticketGeneratorDone = Promise.resolve();
  ready();

  while (!isFinished) {
    const state = getBestState();

    // query current expected time slot
    const stateTimeSlot = state.timeslot;
    const newTimeSlot = timeSlotHandler.getCurrentTimeSlot(stateTimeSlot);
    const epochPhase = newTimeSlot % chainSpec.epochLength;

    // Seems that the epoch is changing, let's transition
    if (epochData === null || epochTracker.isEpochChanged(stateTimeSlot, newTimeSlot)) {
      const oldEpochData = epochData;
      const epochDataResult = await epochTracker.getEpochData(logger, state, newTimeSlot);
      if (epochDataResult.isError) {
        // Couldn't compute the sealing keys for this epoch — wait and retry rather
        // than crashing the worker (`epochData` keeps its previous value, if any).
        logger.warn`[#${newTimeSlot}] Could not compute epoch data: ${epochDataResult.details()}`;
        await timeSlotHandler.waitForNextSlot(false, epochPhase, ticketGeneratorDone);
        continue;
      }
      epochData = epochDataResult.ok;
      const epochIndex = epochData.epoch;
      if (oldEpochData === null) {
        logger.info`🎁 [E${epochIndex}#${newTimeSlot}] starting authorship (state at #${stateTimeSlot})`;
      } else {
        logger.info`🎁 [E${oldEpochData.epoch}#${stateTimeSlot} -> E${epochIndex}#${newTimeSlot}] epoch transition`;
      }

      // On every epoch boundary, push the authoritative ticket pool to networking so it
      // can replace its redistribution set; this keeps the two sides from drifting.
      const tickets = verifiedPool.getForEpoch(epochIndex).map((entry) => entry.ticket);
      await networkingComms.sendReplaceTicketPool({
        epochIndex,
        tickets,
      });

      // Let's generate some tickets for the next epoch if we still have time
      if (epochPhase < chainSpec.contestLength) {
        const generatingForEpoch = epochData.epoch;
        const isEpochStart = epochPhase === 0;
        ticketGeneratorDone = ticketGenerator.generateTickets(state, isEpochStart, async (tickets) => {
          // too late!
          if (generatingForEpoch !== epochData?.epoch) {
            return;
          }
          const isValid = await onEpochTickets(generatingForEpoch, tickets, "generator");
          // Push our freshly generated tickets to networking so they're redistributed
          // to peers (who include them in their blocks). Without this, a multi-node
          // network never shares tickets and accumulators only ever hold local ones.
          if (isValid) {
            await networkingComms.sendTickets({ epochIndex: generatingForEpoch, tickets });
          }
        });
      }
    }

    const logPrefix = `[E${epochData.epoch}#${newTimeSlot}]`;

    // author a block if we are assigned to that slot
    const currentSlot = epochData.slots[epochPhase];
    if (currentSlot !== null) {
      const { logId, key, sealPayload } = currentSlot;
      // figure out validator index
      const validatorIndex = getValidatorIndex(key.bandersnatchPublic, state.currentValidatorData);
      if (validatorIndex === null) {
        logger.log`${logPrefix} Not currently validator, yet ${currentSlot.logId} is present.`;
        // Don't spin: wait for the next slot before re-checking (otherwise this is
        // a tight hot loop until some other component advances the DB).
        await timeSlotHandler.waitForNextSlot(false, epochPhase, ticketGeneratorDone);
        continue;
      }

      logger.log`${logPrefix} Creating block using ${logId} (valIdx: ${validatorIndex})`;
      // retrieve epoch tickets to include
      const currentEpochTickets = verifiedPool.getForEpoch(epochData.epoch);
      const newBlock = await generator.nextBlockView(
        validatorIndex,
        key.bandersnatchSecret,
        sealPayload,
        newTimeSlot,
        // VerifiedTicket has the same `{ ticket, id }` shape the generator expects.
        [...currentEpochTickets],
      );
      logger.trace`${logPrefix} sending block`;
      await comms.sendBlock(newBlock);
    }

    logger.trace`${logPrefix} awaiting next slot`;
    await timeSlotHandler.waitForNextSlot(currentSlot !== null, epochPhase, ticketGeneratorDone);
  }

  logger.info`🎁 Block Authorship finished. Closing channel.`;
  await db.close();
}

function getValidatorIndex(key: BandersnatchKey, currentValidatorData: PerValidator<ValidatorData>) {
  const index = currentValidatorData.findIndex((data) => data.bandersnatch.isEqualTo(key));
  if (index < 0) {
    return null;
  }
  return tryAsValidatorIndex(index);
}

/**
 * How many slots before the end of the contest period we force-await the ticket
 * generator in fast-forward mode. Without this, blocks are produced faster than
 * tickets are generated and the accumulator never fills (→ Keys-mode fallback).
 *
 * Derived so that, after the wait completes, there are enough remaining contest
 * slots to include a full accumulator worth of tickets (`epochLength` tickets at
 * `maxTicketsPerExtrinsic` per block), plus a small buffer.
 */
function ticketInclusionMargin(chainSpec: ChainSpec): number {
  return Math.ceil(chainSpec.epochLength / chainSpec.maxTicketsPerExtrinsic) + 4;
}

function systemTimeMs(): bigint {
  return process.hrtime.bigint() / 1_000_000n;
}

class TimeSlotHandler {
  private readonly systemStartTimeMs: bigint;
  private readonly stateStartTime: bigint;

  static new(isFastForward: boolean, chainSpec: ChainSpec, stateTimeSlot: TimeSlot) {
    const slotDurationMs = BigInt(chainSpec.slotDuration) * 1_000n;
    return new TimeSlotHandler(
      stateTimeSlot,
      slotDurationMs,
      isFastForward,
      chainSpec.contestLength,
      ticketInclusionMargin(chainSpec),
    );
  }

  private constructor(
    public readonly initialStateTimeSlot: TimeSlot,
    private readonly slotDurationMs: bigint,
    private readonly isFastForward: boolean,
    private readonly contestLength: U32,
    private readonly inclusionMargin: number,
  ) {
    this.systemStartTimeMs = systemTimeMs();
    this.stateStartTime = BigInt(initialStateTimeSlot) * slotDurationMs;
  }

  /**
   * In fastForward mode, use simulated time (next slot after current state).
   * In normal mode, use wall clock time.
   * Assuming `slotDuration` is 6 sec it is safe till year 2786.
   * If `slotDuration` is 1 sec then it is safe till 2106.
   */
  getCurrentTimeSlot(stateTimeSlot: TimeSlot) {
    return this.isFastForward === true
      ? tryAsTimeSlot(stateTimeSlot + 1)
      : tryAsTimeSlot(Number(this.getVirtualTimeMs() / this.slotDurationMs));
  }

  async waitForNextSlot(wasAuthoring: boolean, epochPhase: number, ticketGeneratorDone: Promise<void>) {
    if (this.isFastForward) {
      // when we approach the end of the contest period make sure to wait for all tickets
      if (epochPhase < this.contestLength && epochPhase + this.inclusionMargin > this.contestLength) {
        await ticketGeneratorDone;
      }
      // return as fast as possible
      if (wasAuthoring) {
        return;
      }
      // or wait for other nodes to produce a block
      return await setTimeout(100);
    }
    // Sleep until the next slot boundary (not a full slot from "now") so the
    // wakeup doesn't drift later and later as block work eats into each slot.
    const elapsedInSlot = this.getVirtualTimeMs() % this.slotDurationMs;
    const waitMs = elapsedInSlot === 0n ? this.slotDurationMs : this.slotDurationMs - elapsedInSlot;
    await setTimeout(Number(waitMs));
  }

  /**
   * We assume there is no gap between system time and the initial state time.
   *
   * I.e. we can resume any database by moving the state time to the future.
   */
  private getVirtualTimeMs() {
    const timeFromStart = systemTimeMs() - this.systemStartTimeMs;
    return tryAsU64(this.stateStartTime + timeFromStart + this.slotDurationMs);
  }
}
