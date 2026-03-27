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
import { asOpaqueType, Result } from "@typeberry/utils";
import type { WorkerConfig } from "@typeberry/workers-api";
import { type BlockSealInput, Generator } from "./generator.js";
import type { BlockAuthorshipConfig, GeneratorInternal } from "./protocol.js";
import { generateTickets } from "./ticket-generator.js";

const logger = Logger.new(import.meta.filename, "author");

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

  const generator = new Generator(chainSpec, bandersnatch, keccakHasher, blake2bHasher, blocks, states);

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
  if (initialState !== null) {
    const initialKeys = await getSealingKeySeries(
      startTimeSlot % chainSpec.epochLength === 0,
      startTimeSlot,
      initialState,
    );
    if (initialKeys.isOk) {
      logEpochBlockCreation(tryAsEpoch(Math.floor(startTimeSlot / chainSpec.epochLength)), initialKeys.ok);
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

  // Per-epoch cache for Tickets mode: index corresponds to position in sealingKeySeries.tickets.
  // null entry means none of our keys match that slot.
  // Rebuilt once per epoch via buildTicketAuthorshipCache().
  let ticketAuthorshipCache: Array<{ key: ValidatorKeys; sealPayload: BlockSealInput } | null> | null = null;

  /**
   * Precomputes which slots we are the author of for the current epoch (Tickets mode).
   *
   * Iterates over every ticket in sealingKeySeries once and runs getVrfOutputHash for
   * each of our keys. Stores the result indexed by ticket position so getAuthorInfo
   * can do a O(1) array lookup per slot instead of O(keys) VRF calls.
   *
   * Called once at the start of each epoch when isNewEpoch = true.
   */
  async function buildTicketAuthorshipCache(sealingKeySeries: SafroleSealingKeys, entropy: EntropyHash) {
    if (sealingKeySeries.kind !== SafroleSealingKeysKind.Tickets) {
      ticketAuthorshipCache = null;
      return;
    }
    const cache: Array<{ key: ValidatorKeys; sealPayload: BlockSealInput } | null> = [];
    for (const ticket of sealingKeySeries.tickets) {
      const payload = BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([ticket.attempt]));
      let found: { key: ValidatorKeys; sealPayload: BlockSealInput } | null = null;
      for (const key of keys) {
        const result = await bandersnatchVrf.getVrfOutputHash(bandersnatch, key.bandersnatchSecret, payload);
        if (result.isOk && ticket.id.isEqualTo(result.ok)) {
          found = { key, sealPayload: asOpaqueType(payload) };
          break;
        }
      }
      cache.push(found);
    }
    ticketAuthorshipCache = cache;
    const ours = cache.filter(Boolean).length;
    logger.info`Built ticket authorship cache: ${ours}/${cache.length} slots assigned to us this epoch.`;
  }

  /**
   * Returns the validator key and seal payload for the current slot, or null if we are not the author.
   *
   * Keys mode (fallback): matches our key against the slot's assigned bandersnatch key.
   * Tickets mode: uses precomputed cache (built once per epoch) for O(1) lookup per slot.
   */
  async function getAuthorInfo(
    sealingKeySeries: SafroleSealingKeys,
    keys: ValidatorKeys[],
    timeSlot: TimeSlot,
    entropy: EntropyHash,
  ): Promise<{ key: ValidatorKeys; sealPayload: BlockSealInput; logId: string } | null> {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      const indexForCurrentSlot = timeSlot % sealingKeySeries.keys.length;
      const sealingKey = sealingKeySeries.keys[indexForCurrentSlot];
      const key = keys.find((x) => x.bandersnatchPublic.isEqualTo(sealingKey)) ?? null;
      if (key === null) {
        return null;
      }
      return {
        key,
        sealPayload: asOpaqueType(BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw)),
        logId: `key ${key.bandersnatchPublic}`,
      };
    }

    // Tickets mode: each slot is sealed by the validator who can produce the VRF output
    // matching the ticket's ID for that slot.
    const index = timeSlot % sealingKeySeries.tickets.length;
    const ticket = sealingKeySeries.tickets.at(index);
    if (ticket === undefined) {
      return null;
    }

    // Fast path: use precomputed cache (available after first isNewEpoch iteration)
    if (ticketAuthorshipCache !== null) {
      const cached = ticketAuthorshipCache[index] ?? null;
      if (cached === null) {
        return null;
      }
      return { ...cached, logId: `ticket ${ticket.id} (attempt ${ticket.attempt})` };
    }

    // Slow path: compute VRF on the fly (first slot of epoch, before cache is ready)
    const payload = BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([ticket.attempt]));
    for (const key of keys) {
      const result = await bandersnatchVrf.getVrfOutputHash(bandersnatch, key.bandersnatchSecret, payload);
      if (result.isOk && ticket.id.isEqualTo(result.ok)) {
        return {
          key,
          sealPayload: asOpaqueType(payload),
          logId: `ticket ${ticket.id} (attempt ${ticket.attempt})`,
        };
      }
    }
    return null;
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

  // Ticket pool: epochIndex -> {ticket, id}[]
  // IDs (entropyHash) are computed at receipt time via verifyTickets(), enabling O(1) dedup by ID.
  const ticketPool = new Map<number, { ticket: SignedTicket; id: EntropyHash }[]>();
  const ticketIdSets = new Map<number, HashSet<EntropyHash>>();

  /**
   * Adds pre-verified tickets to the in-memory ticket pool for the given epoch.
   *
   * Clears the pool when the epoch changes (we only ever need tickets for one epoch at a time).
   * Deduplicates by ticket ID using a HashSet for O(1) lookup — prevents double-counting
   * tickets received from multiple peers or via both CE-131 and CE-132 paths.
   */
  function addToPool(epochIndex: number, verifiedTickets: { ticket: SignedTicket; id: EntropyHash }[]) {
    if (ticketPool.size > 0 && !ticketPool.has(epochIndex)) {
      ticketPool.clear();
      ticketIdSets.clear();
    }
    const existing = ticketPool.get(epochIndex) ?? [];
    let idSet = ticketIdSets.get(epochIndex);
    if (idSet === undefined) {
      idSet = HashSet.new();
      ticketIdSets.set(epochIndex, idSet);
    }
    for (const entry of verifiedTickets) {
      if (!idSet.has(entry.id)) {
        existing.push(entry);
        idSet.insert(entry.id);
      }
    }
    ticketPool.set(epochIndex, existing);
  }

  /**
   * Returns the correct tickets entropy for verification given the current state.
   *
   * When `state` is from epoch E-1 (i.e. we haven't produced epoch E's first block yet),
   * the ticket entropy for epoch E is at index 1 (not yet shifted).
   * After the epoch transition it moves to index 2.
   */
  function getTicketEntropy(epochIndex: number, state: State): EntropyHash {
    const stateEpoch = Math.floor(state.timeslot / chainSpec.epochLength);
    return epochIndex > stateEpoch ? state.entropy[1] : state.entropy[2];
  }

  /**
   * Verifies tickets against the ring commitment and current epoch entropy, then adds valid
   * ones to the pool with their computed IDs.
   *
   * Called both for own generated tickets and for tickets relayed from peers.
   * Verification computes the ticket ID (entropyHash) which is then used for
   * deduplication in the pool and later when building the extrinsic.
   */
  async function verifyAndAddToPool(epochIndex: number, tickets: SignedTicket[], state: State): Promise<boolean> {
    const results = await bandersnatchVrf.verifyTickets(
      bandersnatch,
      state.designatedValidatorData.length,
      state.epochRoot,
      tickets,
      getTicketEntropy(epochIndex, state),
    );
    const verified = tickets
      .map((ticket, i) => ({ ticket, id: results[i].entropyHash }))
      .filter((_, i) => results[i].isValid);
    addToPool(epochIndex, verified);
    return verified.length > 0;
  }

  // Receive a single ticket from peers (via jam-network worker).
  // Returns true if the ticket passed validation so jam-network can decide whether to redistribute it.
  networkingComms.setOnReceivedTickets(async ({ epochIndex, ticket }) => {
    logger.log`Received ticket from peer for epoch ${epochIndex}`;
    const hash = blocks.getBestHeaderHash();
    const state = states.getState(hash);
    if (state === null) {
      logger.warn`Cannot verify received ticket: no state available`;
      return false;
    }
    return await verifyAndAddToPool(epochIndex, [ticket], state);
  });

  const isFastForward = config.workerParams.isFastForward;
  let lastGeneratedSlot = startTimeSlot;
  let ticketsGeneratedForEpoch = -1;

  while (!isFinished) {
    const hash = blocks.getBestHeaderHash();
    const state = states.getState(hash);
    const currentValidatorData = state?.currentValidatorData;

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

    if (shouldGenerateTickets) {
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

          // Verify own tickets to get IDs, then add to pool
          await verifyAndAddToPool(epoch, ticketsResult.ok, state);

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

    if (isNewEpoch) {
      logEpochBlockCreation(epoch, selingKeySeriesResult.ok);
      // Build authorship cache for Tickets mode once per epoch.
      // entropy[2] here is the epoch-E entropy (pre-transition state), same value
      // that will be at entropy[3] after the transition block is applied.
      await buildTicketAuthorshipCache(selingKeySeriesResult.ok, state.entropy[2]);
    }

    const entropy = isNewEpoch ? state.entropy[2] : state.entropy[3];
    const authorInfo = await getAuthorInfo(selingKeySeriesResult.ok, keys, timeSlot, entropy);

    if (authorInfo !== null && currentValidatorData !== undefined) {
      const { key, sealPayload } = authorInfo;
      const validatorIndex = getValidatorIndex(key, currentValidatorData);
      if (validatorIndex === null) {
        continue;
      }

      logger.log`Attempting to create a block using ${authorInfo.logId} located at validator index ${validatorIndex}.`;
      const currentEpochTickets = ticketPool.get(epoch) ?? [];
      const newBlock = await generator.nextBlockView(
        validatorIndex,
        key.bandersnatchSecret,
        sealPayload,
        timeSlot,
        currentEpochTickets, // {ticket, id}[] — already verified
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
  await db.close();
}
