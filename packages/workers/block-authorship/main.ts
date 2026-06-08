import os from "node:os";
import { setTimeout } from "node:timers/promises";
import {
  type EntropyHash,
  type Epoch,
  type PerValidator,
  type TimeSlot,
  tryAsEpoch,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections/hash-dictionary.js";
import { HashSet } from "@typeberry/collections/hash-set.js";
import type { NetworkingComms } from "@typeberry/comms-authorship-network";
import { type BandersnatchKey, type Ed25519Key, initWasm } from "@typeberry/crypto";
import {
  type BandersnatchSecretSeed,
  deriveBandersnatchPublicKey,
  deriveEd25519PublicKey,
  type Ed25519SecretSeed,
} from "@typeberry/crypto/key-derivation.js";
import { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU64 } from "@typeberry/numbers";
import { Safrole } from "@typeberry/safrole";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_FALLBACK_SEAL, JAM_TICKET_SEAL } from "@typeberry/safrole/constants.js";
import { type SafroleSealingKeys, SafroleSealingKeysKind, type State, type ValidatorData } from "@typeberry/state";
import { VerifiedTicketPool } from "@typeberry/ticket-pool";
import { asOpaqueType, now, Result } from "@typeberry/utils";
import type { WorkerConfig } from "@typeberry/workers-api";
import { type BlockSealInput, Generator } from "./generator.js";
import type { BlockAuthorshipConfig, GeneratorInternal } from "./protocol.js";
import { generateTickets } from "./ticket-generator.js";
import { TicketGeneratorPool } from "./ticket-generator-pool.js";
import { BandersnatchTicketValidator } from "./ticket-validator.js";

const logger = Logger.new(import.meta.filename, "author");

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
const TICKET_POOL_MAX_WORKERS = 12;

/** Number of worker threads to use for parallel ticket generation. */
function ticketPoolWorkerCount(): number {
  const cores = os.availableParallelism?.() ?? os.cpus().length;
  return Math.max(1, Math.min(cores - TICKET_POOL_RESERVED_CORES, TICKET_POOL_MAX_WORKERS));
}

type Config = WorkerConfig<BlockAuthorshipConfig>;

/**
 * The `BlockAuthorship` should create new blocks and send them as signals to the main thread.
 */

type ValidatorPrivateKeys = {
  bandersnatchSecret: BandersnatchSecretSeed;
  ed25519Secret: Ed25519SecretSeed;
};

type ValidatorPublicKeys = {
  bandersnatchPublic: BandersnatchKey;
  ed25519Public: Ed25519Key;
};

type SealData = {
  key: ValidatorKeys;
  sealPayload: BlockSealInput;
  logId?: string;
};

type ValidatorKeys = ValidatorPrivateKeys & ValidatorPublicKeys;

export async function main(config: Config, comms: GeneratorInternal, networkingComms: NetworkingComms) {
  await initWasm();
  logger.info`🎁 Block Authorship running`;
  const chainSpec = config.chainSpec;
  const db = config.openDatabase();
  const blocks = db.getBlocksDb();
  const states = db.getStatesDb();

  let isFinished = false;
  comms.setOnFinish(async () => {
    isFinished = true;
  });

  // Generate blocks until the close signal is received.
  let counter = 0;
  const blake2bHasher = await Blake2b.createHasher();
  const bandersnatch = await BandernsatchWasm.new();
  const keccakHasher = await keccak.KeccakHasher.create();

  const hash = blocks.getBestHeaderHash();
  const startTime = tryAsU64(process.hrtime.bigint() / 1_000_000n);
  const startTimeSlot = states.getState(hash)?.timeslot ?? tryAsTimeSlot(0);

  const generator = Generator.new({
    chainSpec,
    bandersnatch,
    keccakHasher,
    blake2b: blake2bHasher,
    blocks,
    states,
  });

  const keys = await Promise.all(
    config.workerParams.keys.map(async (secrets) => ({
      bandersnatchSecret: secrets.bandersnatch,
      bandersnatchPublic: deriveBandersnatchPublicKey(secrets.bandersnatch),
      ed25519Secret: secrets.ed25519,
      ed25519Public: await deriveEd25519PublicKey(secrets.ed25519),
    })),
  );

  const initialHash = blocks.getBestHeaderHash();
  const initialState = states.getState(initialHash);

  logger.info`Block authorship validator keys: ${keys.map(({ bandersnatchPublic }, index) => `\n ${index}: ${bandersnatchPublic.toString()}`)}`;

  // Per-epoch cache for Tickets mode: index corresponds to position in sealingKeySeries.tickets.
  // null entry means none of our keys match that slot.
  // Rebuilt once per epoch via buildTicketAuthorshipCache().
  // Declared here (before the eager startup build below) so its TDZ doesn't fire
  // when `buildTicketAuthorshipCache` runs during initialisation.
  let ticketAuthorshipCache: Array<SealData | null> | null = null;

  if (initialState !== null) {
    const isEpochStart = startTimeSlot % chainSpec.epochLength === 0;
    const initialKeys = await getSealingKeySeries(isEpochStart, startTimeSlot, initialState);
    if (initialKeys.isOk) {
      logEpochBlockCreation(tryAsEpoch(Math.floor(startTimeSlot / chainSpec.epochLength)), initialKeys.ok);
      // Build the cache eagerly so the first slot of a session doesn't need an
      // on-the-fly VRF scan. After this, `buildTicketAuthorshipCache` is only
      // re-run on epoch boundaries.
      const initialEntropy = isEpochStart ? initialState.entropy[2] : initialState.entropy[3];
      await buildTicketAuthorshipCache(initialKeys.ok, initialEntropy);
    }
  }

  function getTime() {
    const currentTime = process.hrtime.bigint() / 1_000_000n;
    const timeFromStart = currentTime - startTime;
    const slotDurationMs = BigInt(chainSpec.slotDuration * 1000);
    return tryAsU64(BigInt(startTimeSlot) * slotDurationMs + timeFromStart + slotDurationMs);
  }

  function getValidatorIndex(key: ValidatorKeys, currentValidatorData: PerValidator<ValidatorData>) {
    const index = currentValidatorData.findIndex((data) => data.bandersnatch.isEqualTo(key.bandersnatchPublic));
    if (index < 0) {
      return null;
    }
    return tryAsValidatorIndex(index);
  }

  /**
   * Precomputes which slots we are the author of for the current epoch (Tickets mode).
   */
  async function buildTicketAuthorshipCache(sealingKeySeries: SafroleSealingKeys, entropy: EntropyHash) {
    if (sealingKeySeries.kind !== SafroleSealingKeysKind.Tickets) {
      ticketAuthorshipCache = null;
      return;
    }

    const ownTickets = new HashDictionary<EntropyHash, SealData>();
    for (let attempt = 0; attempt < chainSpec.ticketsPerValidator; attempt++) {
      const payload = getTicketSealPayload(entropy, attempt);
      for (const key of keys) {
        const result = await bandersnatchVrf.getVrfOutputHash(bandersnatch, key.bandersnatchSecret, payload);
        if (result.isOk) {
          ownTickets.set(result.ok.asOpaque<EntropyHash>(), { key, sealPayload: asOpaqueType(payload) });
        }
      }
    }

    const cache = sealingKeySeries.tickets.map((ticket) => ownTickets.get(ticket.id.asOpaque<EntropyHash>()) ?? null);
    ticketAuthorshipCache = cache;
    const ours = cache.filter(Boolean).length;
    logger.info`Built ticket authorship cache: ${ours}/${cache.length} slots assigned to us this epoch.`;
  }

  function getTicketSealPayload(entropy: EntropyHash, attempt: number): BytesBlob {
    return BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([attempt]));
  }

  function getFallbackSealPayload(entropy: EntropyHash): BlockSealInput {
    return asOpaqueType(BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw));
  }

  /**
   * Returns the validator key and seal payload for the current slot, or null if we are not the author.
   *
   * Keys mode (fallback): matches our key against the slot's assigned bandersnatch key.
   * Tickets mode: O(1) lookup against the per-epoch authorship cache (built eagerly at
   * startup and on every epoch transition, so we never fall back to on-the-fly VRF).
   */
  function getSealData(
    sealingKeySeries: SafroleSealingKeys,
    keys: ValidatorKeys[],
    timeSlot: TimeSlot,
    entropy: EntropyHash,
  ): SealData | null {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      const indexForCurrentSlot = timeSlot % sealingKeySeries.keys.length;
      const sealingKey = sealingKeySeries.keys[indexForCurrentSlot];
      const key = keys.find((x) => x.bandersnatchPublic.isEqualTo(sealingKey)) ?? null;
      if (key === null) {
        return null;
      }

      return {
        key,
        sealPayload: getFallbackSealPayload(entropy),
        logId: `key ${key.bandersnatchPublic}`,
      };
    }

    // Tickets mode: each slot is sealed by the validator who can produce the VRF output
    // matching the ticket's ID for that slot.
    const index = timeSlot % sealingKeySeries.tickets.length;
    const ticket = sealingKeySeries.tickets.at(index) ?? null;
    const cached = ticketAuthorshipCache?.at(index) ?? null;
    if (ticket === null || cached === null) {
      return null;
    }
    return { ...cached, logId: `ticket ${ticket.id} (attempt ${ticket.attempt})` };
  }

  function isEpochChanged(lastTimeslot: TimeSlot, currentTimeslot: TimeSlot): boolean {
    const lastEpoch = Math.floor(lastTimeslot / chainSpec.epochLength);
    const currentEpoch = Math.floor(currentTimeslot / chainSpec.epochLength);
    return currentEpoch > lastEpoch;
  }

  function logEpochBlockCreation(epoch: Epoch, sealingKeySeries: SafroleSealingKeys) {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Tickets) {
      logger.info`[EPOCH ${epoch}] Tickets mode active with ${sealingKeySeries.tickets.length} tickets.`;
      return;
    }

    let isCreating = false;
    const epochStart = epoch * chainSpec.epochLength;
    const epochEnd = epochStart + chainSpec.epochLength;
    for (let slot = epochStart; slot < epochEnd; slot++) {
      const indexForCurrentSlot = slot % sealingKeySeries.keys.length;
      const sealingKey = sealingKeySeries.keys[indexForCurrentSlot];
      const key = keys.find((x) => x.bandersnatchPublic.isEqualTo(sealingKey)) ?? null;
      if (key !== null) {
        isCreating = true;
        logger.info`[EPOCH ${epoch}] Validator ${key.bandersnatchPublic.toString()} will author block at slot ${slot}`;
      }
    }

    if (isCreating === false) {
      logger.info`[EPOCH ${epoch}] No blocks to author for this epoch.`;
    }
  }

  async function getSealingKeySeries(isNewEpoch: boolean, timeSlot: TimeSlot, state: State) {
    if (isNewEpoch) {
      const safrole = new Safrole(chainSpec, blake2bHasher, state);
      return await safrole.getSealingKeySeries({
        entropy: state.entropy[1],
        slot: timeSlot,
        punishSet: state.disputesRecords.punishSet,
      });
    }

    return Result.ok(state.sealingKeySeries);
  }

  // Verified tickets for the current epoch, keyed by entropy hash (ticket id).
  // Tickets enter via `validator.validate(...)` which both verifies and inserts.
  const verifiedPool = new VerifiedTicketPool();

  const ticketValidator = new BandersnatchTicketValidator(bandersnatch, chainSpec, verifiedPool, () =>
    states.getState(blocks.getBestHeaderHash()),
  );

  // Receive a single ticket from peers (via jam-network worker).
  // Returns true if the ticket passed validation so jam-network can decide whether to redistribute it.
  networkingComms.setOnReceivedTickets(async ({ epochIndex, ticket }) => {
    logger.log`Received ticket from peer for epoch ${epochIndex}`;
    const result = await ticketValidator.validate(epochIndex, ticket);
    return result.isOk;
  });

  const isFastForward = config.workerParams.isFastForward;
  let lastGeneratedSlot = startTimeSlot;
  let ticketsGeneratedForEpoch = -1;

  // --- Parallel ticket generation (worker pool) --------------------------
  // Ring-VRF proof generation is CPU-bound and dominates the contest period.
  // We offload it to a pool of worker threads so the authoring thread stays free
  // and wall-clock time drops ~linearly with the number of workers. If the pool
  // cannot be created we fall back to the single-threaded path in the loop.
  let pool: TicketGeneratorPool | null = null;
  if (keys.length > 0) {
    try {
      const workerCount = ticketPoolWorkerCount();
      logger.info`Initialising ticket-generation worker pool (${workerCount} workers)…`;
      pool = await TicketGeneratorPool.create(workerCount);
      logger.info`Ticket-generation worker pool ready (${pool.workerCount} workers).`;
    } catch (e) {
      logger.warn`Could not start ticket-generation worker pool; falling back to single-threaded generation: ${e}`;
      pool = null;
    }
  }

  // Batch-verify own freshly-generated tickets (a single ring check covers the
  // whole batch) and add them to the pool with their computed ids. Cheaper than
  // validating each ticket individually.
  async function addOwnTicketsToPool(epoch: Epoch, tickets: SignedTicket[]) {
    const s = states.getState(blocks.getBestHeaderHash());
    if (s === null) {
      return;
    }
    const stateEpoch = Math.floor(s.timeslot / chainSpec.epochLength);
    const entropy = epoch > stateEpoch ? s.entropy[1] : s.entropy[2];
    const { isValid, tickets: ids } = await bandersnatchVrf.verifyTickets(
      bandersnatch,
      s.designatedValidatorData.length,
      s.epochRoot,
      tickets,
      entropy,
    );
    if (!isValid || ids.length !== tickets.length) {
      logger.warn`Own ticket batch failed verification for epoch ${epoch}`;
      return;
    }
    verifiedPool.add(
      epoch,
      tickets.map((ticket, i) => ({ ticket, id: ids[i] })),
    );
  }

  // Parallel generation is launched once per epoch when we enter its contest
  // period; `parallelGenDone` resolves once every shard has been pooled.
  let parallelGenEpoch = -1;
  let parallelGenDone: Promise<void> | null = null;

  async function ensureParallelGeneration(workerPool: TicketGeneratorPool, state: State, timeSlot: TimeSlot) {
    const epoch = tryAsEpoch(Math.floor(timeSlot / chainSpec.epochLength));
    const slotInEpoch = timeSlot % chainSpec.epochLength;

    // Tickets can only be submitted during the contest period.
    if (slotInEpoch >= chainSpec.contestLength) {
      return;
    }

    // Launch generation once, when we first reach this epoch's contest period.
    if (parallelGenEpoch !== epoch) {
      parallelGenEpoch = epoch;

      const ringKeys = state.designatedValidatorData.map((d) => d.bandersnatch);
      const designatedKeySet = HashSet.from(ringKeys);
      const validatorKeys = keys
        .filter((k) => designatedKeySet.has(k.bandersnatchPublic))
        .map((k) => ({ secret: k.bandersnatchSecret, public: k.bandersnatchPublic }));

      if (validatorKeys.length === 0) {
        parallelGenDone = Promise.resolve();
        return;
      }

      // Snapshot the ticket entropy for the whole epoch (pre-transition it is at
      // index 1, after the transition it shifts to 2 — same underlying value).
      const stateEpoch = Math.floor(state.timeslot / chainSpec.epochLength);
      const entropy = epoch > stateEpoch ? state.entropy[1] : state.entropy[2];

      // Generate just enough validators to fill the accumulator, plus a margin.
      const needed =
        Math.ceil(chainSpec.epochLength / chainSpec.ticketsPerValidator) + TICKET_GENERATION_VALIDATOR_MARGIN;
      const selected = validatorKeys.slice(0, Math.min(validatorKeys.length, needed));

      const startTime = now();
      logger.info`Epoch ${epoch}: generating tickets for ${selected.length} validators across ${workerPool.workerCount} worker threads…`;

      parallelGenDone = workerPool
        .generate(ringKeys, selected, entropy, chainSpec.ticketsPerValidator, async (tickets) => {
          // Runs on the authoring thread as each shard completes.
          await addOwnTicketsToPool(epoch, tickets);
          await networkingComms.sendTickets({ epochIndex: epoch, tickets });
        })
        .then(() => {
          logger.info`Epoch ${epoch}: ticket generation complete in ${((now() - startTime) / 1000).toFixed(1)}s.`;
        })
        .catch((e) => {
          logger.warn`Epoch ${epoch}: parallel ticket generation failed: ${e}`;
        });
    }

    // In fast-forward mode the authoring loop would otherwise blast through the
    // contest period before the off-thread tickets are generated and included,
    // leaving the accumulator unfilled (→ Keys-mode fallback). Wait for
    // generation to finish so there are tickets to include. The wait is seconds
    // (parallel), not minutes (serial), and the thread is idle (workers do the
    // CPU work). In real-time mode the 6s/slot cadence gives ample time, so no
    // wait is needed.
    if (isFastForward && parallelGenDone !== null) {
      await parallelGenDone;
    }
  }

  while (!isFinished) {
    const hash = blocks.getBestHeaderHash();
    const state = states.getState(hash);
    const currentValidatorData = state?.currentValidatorData ?? null;

    if (state === null) {
      continue;
    }

    const lastTimeSlot = state.timeslot;

    /**
     * In fastForward mode, use simulated time (next slot after current state).
     * In normal mode, use wall clock time.
     * Assuming `slotDuration` is 6 sec it is safe till year 2786.
     * If `slotDuration` is 1 sec then it is safe till 2106.
     */
    const timeSlot =
      isFastForward === true
        ? tryAsTimeSlot(lastTimeSlot + 1)
        : tryAsTimeSlot(Number(getTime() / 1000n / BigInt(chainSpec.slotDuration)));

    // In fastForward mode, skip if we already generated for this slot (waiting for import)
    if (isFastForward === true && timeSlot <= lastGeneratedSlot) {
      continue;
    }

    const isNewEpoch = isEpochChanged(lastTimeSlot, timeSlot);

    // Generate tickets if within contest period and not yet generated for this epoch
    const epoch = tryAsEpoch(Math.floor(timeSlot / chainSpec.epochLength));

    const slotInEpoch = timeSlot % chainSpec.epochLength;
    const shouldGenerateTickets = slotInEpoch < chainSpec.contestLength && ticketsGeneratedForEpoch !== epoch;

    if (pool !== null) {
      // Preferred path: offload generation to the worker pool. Keeps this thread
      // free; in fast-forward it briefly waits so authoring doesn't outrun the
      // off-thread generation.
      await ensureParallelGeneration(pool, state, timeSlot);
    } else if (shouldGenerateTickets) {
      // Single-threaded fallback (worker pool unavailable).
      const designatedValidatorData = state.designatedValidatorData;
      const ringKeys = designatedValidatorData.map((data) => data.bandersnatch);
      const designatedKeySet = HashSet.from(ringKeys);
      const validatorKeys = keys
        .filter((k) => designatedKeySet.has(k.bandersnatchPublic))
        .map((k) => ({ secret: k.bandersnatchSecret, public: k.bandersnatchPublic }));

      if (validatorKeys.length > 0) {
        // If state is from the previous epoch, entropy hasn't been shifted yet (index 1).
        // After epoch change, it has been shifted to index 2.
        const ticketEntropy = isNewEpoch ? state.entropy[1] : state.entropy[2];

        logger.info`Epoch ${epoch}, slot ${slotInEpoch}/${chainSpec.contestLength}. Generating tickets for ${validatorKeys.length} validators...`;

        const ticketsResult = await generateTickets(
          bandersnatch,
          ringKeys,
          validatorKeys,
          ticketEntropy,
          chainSpec.ticketsPerValidator,
        );

        if (ticketsResult.isError) {
          logger.warn`Failed to generate tickets for epoch ${epoch}: ${ticketsResult.error}`;
        } else {
          logger.log`Generated ${ticketsResult.ok.length} tickets for epoch ${epoch}. Distributing...`;

          // Verify own tickets (validator stores them in the pool with computed ids).
          for (const ticket of ticketsResult.ok) {
            await ticketValidator.validate(epoch, ticket);
          }

          // Send directly to network worker (bypasses main thread)
          await networkingComms.sendTickets({ epochIndex: epoch, tickets: ticketsResult.ok });
        }
      }

      ticketsGeneratedForEpoch = epoch;
    }

    const selingKeySeriesResult = await getSealingKeySeries(isNewEpoch, timeSlot, state);

    if (selingKeySeriesResult.isError) {
      continue;
    }

    // On a new epoch, `state.entropy[2]` is the epoch-E entropy (pre-transition);
    // mid-epoch, it has already shifted to `entropy[3]`.
    const entropy = isNewEpoch ? state.entropy[2] : state.entropy[3];

    // Rebuild the authorship cache on each epoch boundary, and also catch the case
    // where the startup prebuild was skipped (e.g. initialState was null or the
    // initial sealing-key transition errored) so we don't silently miss Tickets-mode
    // slots until the next epoch boundary.
    const needsCacheRebuild =
      isNewEpoch ||
      (selingKeySeriesResult.ok.kind === SafroleSealingKeysKind.Tickets && ticketAuthorshipCache === null);
    if (needsCacheRebuild) {
      if (isNewEpoch) {
        logEpochBlockCreation(epoch, selingKeySeriesResult.ok);
      }
      await buildTicketAuthorshipCache(selingKeySeriesResult.ok, entropy);
    }

    // On every epoch boundary, push the authoritative ticket pool to networking so it
    // can replace its redistribution set; this keeps the two sides from drifting.
    if (isNewEpoch) {
      const dumpTickets = verifiedPool.getForEpoch(epoch).map((entry) => entry.ticket);
      await networkingComms.sendReplaceTicketPool({ epochIndex: epoch, tickets: dumpTickets });
    }

    const sealData = getSealData(selingKeySeriesResult.ok, keys, timeSlot, entropy);

    if (sealData !== null && currentValidatorData !== null) {
      const { key, sealPayload } = sealData;
      const validatorIndex = getValidatorIndex(key, currentValidatorData);
      if (validatorIndex === null) {
        continue;
      }

      logger.log`Attempting to create a block using ${sealData.logId} located at validator index ${validatorIndex}.`;
      const currentEpochTickets = verifiedPool.getForEpoch(epoch);
      const newBlock = await generator.nextBlockView(
        validatorIndex,
        key.bandersnatchSecret,
        sealPayload,
        timeSlot,
        // VerifiedTicket has the same `{ ticket, id }` shape the generator expects.
        [...currentEpochTickets],
      );
      counter += 1;
      lastGeneratedSlot = timeSlot;
      logger.trace`Sending block ${counter}`;
      await comms.sendBlock(newBlock);
    } else if (isFastForward === true) {
      // In fast-forward mode, if this slot is not ours, wait briefly for other validators to produce blocks
      await setTimeout(10);
    }

    if (isFastForward === false) {
      await setTimeout(chainSpec.slotDuration * 1000);
    }
  }

  logger.info`🎁 Block Authorship finished. Closing channel.`;
  await pool?.destroy();
  await db.close();
}
