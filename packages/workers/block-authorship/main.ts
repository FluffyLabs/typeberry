import { setTimeout } from "node:timers/promises";
import {
  type EntropyHash,
  type PerValidator,
  type TimeSlot,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets.js";
import { BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { type BandersnatchKey, type Ed25519Key, initWasm } from "@typeberry/crypto";
import {
  type BandersnatchSecretSeed,
  deriveBandersnatchPublicKey,
  deriveEd25519PublicKey,
  type Ed25519SecretSeed,
} from "@typeberry/crypto/key-derivation.js";
import type { BlocksDb, LeafDb, StatesDb } from "@typeberry/database";
import { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU64 } from "@typeberry/numbers";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_FALLBACK_SEAL, JAM_TICKET_SEAL } from "@typeberry/safrole/constants.js";
import { type SafroleSealingKeys, SafroleSealingKeysKind, type ValidatorData } from "@typeberry/state";
import type { SerializedState } from "@typeberry/state-merkleization";
import { asOpaqueType, assertNever } from "@typeberry/utils";
import type { WorkerConfig } from "@typeberry/workers-api";
import { type BlockSealInput, Generator } from "./generator.js";
import type { BlockAuthorshipConfig, GeneratorInternal } from "./protocol.js";

const logger = Logger.new(import.meta.filename, "author");

type Config = WorkerConfig<BlockAuthorshipConfig, BlocksDb, StatesDb<SerializedState<LeafDb>>>;

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
  const bandersnatch = BandernsatchWasm.new();

  const hash = blocks.getBestHeaderHash();
  const startTime = tryAsU64(process.hrtime.bigint() / 1_000_000n);
  const startTimeSlot = states.getState(hash)?.timeslot ?? tryAsTimeSlot(0);
  const generator = new Generator(
    chainSpec,
    bandersnatch,
    await keccak.KeccakHasher.create(),
    blake2bHasher,
    blocks,
    states,
  );

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

  function getSealingKeyIndex(chainSpec: ChainSpec) {
    const currentTime = getTime();
    const slotDurationMs = BigInt(chainSpec.slotDuration * 1000);
    const currentSlot = Number(currentTime / slotDurationMs);
    return currentSlot % chainSpec.epochLength;
  }

  function getKeyForCurrentSlot(sealingKeySeries: SafroleSealingKeys, keys: ValidatorKeys[]) {
    if (sealingKeySeries.kind === SafroleSealingKeysKind.Keys) {
      const indexForCurrentSlot = getSealingKeyIndex(chainSpec);
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

  while (!isFinished) {
    const hash = blocks.getBestHeaderHash();
    const state = states.getState(hash);
    const sealingKeySeries = state?.sealingKeySeries;
    const currentValidatorData = state?.currentValidatorData;

    if (sealingKeySeries === undefined || state === null) {
      continue;
    }

    const key = getKeyForCurrentSlot(sealingKeySeries, keys);
    const time = getTime();
    const timeslot = tryAsTimeSlot(Number(time / 1000n / BigInt(chainSpec.slotDuration)));
    const lastTimeslot = state.timeslot;

    if (key !== null && currentValidatorData !== undefined) {
      const validatorIndex = getValidatorIndex(key, currentValidatorData);
      if (validatorIndex === null) {
        continue;
      }

      logger.log`Attempting to create a block using key ${key.bandersnatchPublic} located at validator index ${validatorIndex}.`;
      const entropy = isEpochChanged(lastTimeslot, timeslot) ? state.entropy[2] : state.entropy[3];
      const sealPayload = getSealPayload(sealingKeySeries, entropy);
      const newBlock = await generator.nextBlockView(validatorIndex, key.bandersnatchSecret, sealPayload, time);
      counter += 1;
      logger.trace`Sending block ${counter}`;
      await comms.sendBlock(newBlock);
    }

    await setTimeout(chainSpec.slotDuration * 1000);
  }

  logger.info`🎁 Block Authorship finished. Closing channel.`;
  await db.close();
}
