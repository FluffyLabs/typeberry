import { setTimeout } from "node:timers/promises";
import {
  type EntropyHash,
  type PerValidator,
  type TimeSlot,
  tryAsEpoch,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets.js";
import { BytesBlob } from "@typeberry/bytes";
import { HashSet } from "@typeberry/collections/hash-set.js";
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
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_FALLBACK_SEAL, JAM_TICKET_SEAL } from "@typeberry/safrole/constants.js";
import { type SafroleSealingKeys, SafroleSealingKeysKind, type State, type ValidatorData } from "@typeberry/state";
import { asOpaqueType, assertNever, Result } from "@typeberry/utils";
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

export async function main(config: Config, comms: GeneratorInternal) {
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

  logger.info`Block authorship validator keys: ${keys.map(({ bandersnatchPublic }, index) => `\n ${index}: ${bandersnatchPublic.toString()}`)}`;

  function getTime() {
    const currentTime = process.hrtime.bigint() / 1_000_000n;
    const timeFromStart = currentTime - startTime;
    const slotDurationMs = BigInt(chainSpec.slotDuration * 1000);
    return tryAsU64(BigInt(startTimeSlot) * slotDurationMs + timeFromStart + slotDurationMs);
  }

  function getKeyForCurrentSlot(sealingKeySeries: SafroleSealingKeys, keys: ValidatorKeys[], timeSlot: TimeSlot) {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      const indexForCurrentSlot = timeSlot % sealingKeySeries.keys.length;
      const sealingKey = sealingKeySeries.keys[indexForCurrentSlot];
      return keys.find((x) => x.bandersnatchPublic.isEqualTo(sealingKey)) ?? null;
    }

    throw new Error("Tickets mode is not supported yet");
  }

  function getValidatorIndex(key: ValidatorKeys, currentValidatorData: PerValidator<ValidatorData>) {
    const index = currentValidatorData.findIndex((data) => data.bandersnatch.isEqualTo(key.bandersnatchPublic));
    if (index < 0) {
      return null;
    }
    return tryAsValidatorIndex(index);
  }

  function getSealPayload(
    sealingKeySeries: SafroleSealingKeys,
    entropy: EntropyHash,
    attempt?: TicketAttempt,
  ): BlockSealInput {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      return asOpaqueType(BytesBlob.blobFromParts(JAM_FALLBACK_SEAL, entropy.raw));
    }

    if (sealingKeySeries.kind === SafroleSealingKeysKind.Tickets) {
      return asOpaqueType(BytesBlob.blobFromParts(JAM_TICKET_SEAL, entropy.raw, new Uint8Array([attempt ?? 0])));
    }

    assertNever(sealingKeySeries);
  }

  function isEpochChanged(lastTimeslot: TimeSlot, currentTimeslot: TimeSlot): boolean {
    const lastEpoch = Math.floor(lastTimeslot / chainSpec.epochLength);
    const currentEpoch = Math.floor(currentTimeslot / chainSpec.epochLength);
    return currentEpoch > lastEpoch;
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
          await comms.sendTickets({ epochIndex: epoch, tickets: ticketsResult.ok });
        }
      }

      ticketsGeneratedForEpoch = epoch;
    }

    const selingKeySeriesResult = await getSealingKeySeries(isNewEpoch, timeSlot, state);

    if (selingKeySeriesResult.isError) {
      continue;
    }
    const key = getKeyForCurrentSlot(selingKeySeriesResult.ok, keys, timeSlot);

    if (key !== null && currentValidatorData !== undefined) {
      const validatorIndex = getValidatorIndex(key, currentValidatorData);
      if (validatorIndex === null) {
        continue;
      }

      logger.log`Attempting to create a block using key ${key.bandersnatchPublic} located at validator index ${validatorIndex}.`;
      const entropy = isNewEpoch ? state.entropy[2] : state.entropy[3];
      const sealPayload = getSealPayload(selingKeySeriesResult.ok, entropy);
      const newBlock = await generator.nextBlockView(validatorIndex, key.bandersnatchSecret, sealPayload, timeSlot);
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
