import type { EntropyHash } from "@typeberry/block";
import { SignedTicket, tryAsTicketAttempt } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { BandersnatchKey, BandersnatchSecretSeed } from "@typeberry/crypto";
import { SEED_SIZE } from "@typeberry/crypto";
import {
  BANDERSNATCH_PROOF_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  type BandersnatchRingRoot,
  type BandersnatchVrfSignature,
} from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { type Opaque, Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm.js";
import { JAM_TICKET_SEAL } from "./constants.js";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

/**
 * Getting a ring commitment is pretty expensive (hundreds of ms),
 * yet the validators do not always change.
 * For current benchmarks, we get a huge hit every epoch, hence
 * to overcome that we cache the results of getting ring commitment.
 * Note we can also tentatively populate this cache, before we even
 * reach the epoch change block.
 *
 * Keep number of entries low here, since matching is done by fully
 * comparing the keys.
 * To avoid array re-allocation we keep it's size constant and use
 * index.
 */
let ringCommitmentIndex = 0;
const ringCommitmentCache: CacheEntry[] = [
  {
    keys: BytesBlob.empty(),
    value: Promise.resolve(Result.error(null, () => "")),
  },
  {
    keys: BytesBlob.empty(),
    value: Promise.resolve(Result.error(null, () => "")),
  },
];

type CacheEntry = {
  keys: BytesBlob;
  value: Promise<Result<BandersnatchRingRoot, null>>;
};

const FUNCTIONS = {
  verifySeal,
  verifyHeaderSeals,
  verifyTickets,
  getRingCommitment,
  generateSeal,
  getVrfOutputHash,
  generateTickets,
  generateTicketsForValidators,
};

// NOTE [ToDr] We export the entire object to allow mocking in tests.
// Ideally we would just export functions and figure out how to mock
// properly in ESM.
export default FUNCTIONS;

const VRF_SEAL_VERIFICATION_FAILED = () => "Bandersnatch VRF seal verification failed";

async function verifyHeaderSeals(
  bandersnatch: BandernsatchWasm,
  authorKey: BandersnatchKey,
  signature: BandersnatchVrfSignature,
  payload: BytesBlob,
  encodedUnsealedHeader: BytesBlob,
  entropySignature: BandersnatchVrfSignature,
  entropyPayloadPrefix: BytesBlob,
): Promise<Result<[EntropyHash, EntropyHash], null>> {
  const sealResult = await bandersnatch.verifyHeaderSeals(
    authorKey.raw,
    signature.raw,
    payload.raw,
    encodedUnsealedHeader.raw,
    entropySignature.raw,
    entropyPayloadPrefix.raw,
  );

  if (sealResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, VRF_SEAL_VERIFICATION_FAILED);
  }

  return Result.ok([
    Bytes.fromBlob(sealResult.subarray(1, 33), HASH_SIZE).asOpaque(),
    Bytes.fromBlob(sealResult.subarray(33), HASH_SIZE).asOpaque(),
  ]);
}

async function verifySeal(
  bandersnatch: BandernsatchWasm,
  authorKey: BandersnatchKey,
  signature: BandersnatchVrfSignature,
  payload: BytesBlob,
  encodedUnsealedHeader: BytesBlob,
): Promise<Result<EntropyHash, null>> {
  const sealResult = await bandersnatch.verifySeal(
    authorKey.raw,
    signature.raw,
    payload.raw,
    encodedUnsealedHeader.raw,
  );

  if (sealResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, VRF_SEAL_VERIFICATION_FAILED);
  }

  return Result.ok(Bytes.fromBlob(sealResult.subarray(1), HASH_SIZE).asOpaque());
}

function getRingCommitment(
  bandersnatch: BandernsatchWasm,
  validators: BandersnatchKey[],
): Promise<Result<BandersnatchRingRoot, null>> {
  const keys = BytesBlob.blobFromParts(validators.map((x) => x.raw));
  const cacheEntry = ringCommitmentCache.find((v) => v.keys.isEqualTo(keys));
  if (cacheEntry !== undefined) {
    return cacheEntry.value;
  }

  const value = getRingCommitmentNoCache(bandersnatch, keys);
  ringCommitmentCache[ringCommitmentIndex] = {
    keys,
    value,
  };
  // move the index to point at next entry to override.
  ringCommitmentIndex = (ringCommitmentIndex + 1) % ringCommitmentCache.length;
  return value;
}

const RING_COMMITMENT_FAILED = () => "Bandersnatch ring commitment calculation failed";
async function getRingCommitmentNoCache(
  bandersnatch: BandernsatchWasm,
  keys: BytesBlob,
): Promise<Result<BandersnatchRingRoot, null>> {
  const commitmentResult = await bandersnatch.getRingCommitment(keys.raw);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, RING_COMMITMENT_FAILED);
  }

  return Result.ok(Bytes.fromBlob(commitmentResult.subarray(1), BANDERSNATCH_RING_ROOT_BYTES).asOpaque());
}

async function verifyTickets(
  bandersnatch: BandernsatchWasm,
  numberOfValidators: number,
  epochRoot: BandersnatchRingRoot,
  tickets: readonly SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; tickets: EntropyHash[] }> {
  const contextLength = entropy.length + JAM_TICKET_SEAL.length + 1;

  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) =>
        BytesBlob.blobFromParts([ticket.signature.raw, JAM_TICKET_SEAL, entropy.raw, Uint8Array.of(ticket.attempt)])
          .raw,
    ),
  ).raw;

  const verificationResult = await bandersnatch.batchVerifyTicket(
    numberOfValidators,
    epochRoot.raw,
    ticketsData,
    contextLength,
  );
  const isValid = verificationResult[RESULT_INDEX] === ResultValues.Ok;
  // NOTE: in case of failure, the hashes will be all zeros, but we can safely
  // keep the same code path.
  const chunks = BytesBlob.blobFrom(verificationResult.subarray(1)).chunks(HASH_SIZE);
  const results: EntropyHash[] = [];
  for (const entropyHash of chunks) {
    results.push(Bytes.fromBlob(entropyHash.raw, HASH_SIZE).asOpaque());
  }
  return { isValid, tickets: results };
}

const SEAL_FAILED_ERROR = () => "Seal generation failed";
async function generateSeal(
  bandersnatch: BandernsatchWasm,
  authorKey: BandersnatchSecretSeed,
  input: BytesBlob,
  auxData: BytesBlob,
): Promise<Result<BandersnatchVrfSignature, null>> {
  const result = await bandersnatch.generateSeal(authorKey.raw, input.raw, auxData.raw);

  if (result[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, SEAL_FAILED_ERROR);
  }

  return Result.ok(Bytes.fromBlob(result.subarray(1), BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque());
}

export type VrfOutputHash = Opaque<OpaqueHash, "VRF Output Hash">;

const VRF_OUTPUT_FAILED = () => "VRF output hash generation failed";
async function getVrfOutputHash(
  bandersnatch: BandernsatchWasm,
  authorKey: BandersnatchSecretSeed,
  input: BytesBlob,
): Promise<Result<VrfOutputHash, null>> {
  const result = await bandersnatch.getVrfOutputHash(authorKey.raw, input.raw);

  if (result[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null, VRF_OUTPUT_FAILED);
  }

  return Result.ok(Bytes.fromBlob(result.subarray(1), HASH_SIZE).asOpaque());
}

// One byte for result discriminator and the rest is the ring VRF signature.
const GENERATE_RESULT_ENTRY_LENGTH = 1 + BANDERSNATCH_PROOF_BYTES;

/**
 * Generates signed tickets for all attempts at once using batch ring VRF.
 */
async function generateTickets(
  bandersnatch: BandernsatchWasm,
  ringKeys: BandersnatchKey[],
  proverKeyIndex: number,
  key: BandersnatchSecretSeed,
  entropy: EntropyHash,
  ticketsPerValidator: number,
): Promise<Result<SignedTicket[], null>> {
  // Build VRF inputs: JAM_TICKET_SEAL || entropy || attempt_byte for each attempt
  const vrfInputParts: Uint8Array[] = [];
  for (let attempt = 0; attempt < ticketsPerValidator; attempt++) {
    vrfInputParts.push(BytesBlob.blobFromParts([JAM_TICKET_SEAL, entropy.raw, Uint8Array.of(attempt)]).raw);
  }
  const attemptLength = 1;
  const vrfInputDataLen = JAM_TICKET_SEAL.length + entropy.length + attemptLength;
  const inputsData = BytesBlob.blobFromParts(vrfInputParts).raw;
  const ringKeysData = BytesBlob.blobFromParts(ringKeys.map((k) => k.raw)).raw;

  const result = await bandersnatch.batchGenerateRingVrf(
    ringKeysData,
    proverKeyIndex,
    key.raw,
    inputsData,
    vrfInputDataLen,
  );

  const tickets: SignedTicket[] = [];
  for (let attempt = 0; attempt < ticketsPerValidator; attempt++) {
    const offset = attempt * GENERATE_RESULT_ENTRY_LENGTH;
    const resultByte = result[offset];

    if (resultByte === ResultValues.Error) {
      return Result.error(null, () => `Ring VRF proof generation failed for attempt ${attempt}`);
    }

    const signature = Bytes.fromBlob(
      new Uint8Array(result.subarray(offset + 1, offset + GENERATE_RESULT_ENTRY_LENGTH)),
      BANDERSNATCH_PROOF_BYTES,
    ).asOpaque();

    tickets.push(
      SignedTicket.create({
        attempt: tryAsTicketAttempt(attempt),
        signature,
      }),
    );
  }

  return Result.ok(tickets);
}

/**
 * Batch-generate signed tickets for multiple validators in a single native call,
 * reusing the ring prover setup across all of them. Returns one ticket list per
 * validator, in the same order as `proverKeyIndices`/`secrets`.
 *
 * This amortises the (relatively cheap) prover setup across the batch; the
 * dominant cost remains the per-proof ring VRF generation, so the speedup over
 * calling {@link generateTickets} per validator is modest (~14%).
 */
async function generateTicketsForValidators(
  bandersnatch: BandernsatchWasm,
  ringKeys: BandersnatchKey[],
  proverKeyIndices: readonly number[],
  secrets: readonly BandersnatchSecretSeed[],
  entropy: EntropyHash,
  ticketsPerValidator: number,
): Promise<Result<SignedTicket[][], null>> {
  if (proverKeyIndices.length !== secrets.length) {
    return Result.error(null, () => "proverKeyIndices and secrets must have the same length");
  }
  if (proverKeyIndices.length === 0) {
    return Result.ok([]);
  }

  const { inputsData, vrfInputDataLen } = buildTicketVrfInputs(entropy, ticketsPerValidator);
  const ringKeysData = BytesBlob.blobFromParts(ringKeys.map((k) => k.raw)).raw;
  const secretSeedsData = BytesBlob.blobFromParts(secrets.map((s) => s.raw)).raw;

  const result = await bandersnatch.batchGenerateRingVrfForValidators(
    ringKeysData,
    Uint32Array.from(proverKeyIndices),
    secretSeedsData,
    SEED_SIZE,
    inputsData,
    vrfInputDataLen,
  );

  return parseTicketsBatchOutput(result, proverKeyIndices.length, ticketsPerValidator);
}

/**
 * Build the concatenated ring-VRF inputs for ticket generation: one
 * `JAM_TICKET_SEAL || entropy || attempt_byte` input per attempt.
 *
 * Exposed so the worker-pool path can build the same inputs to hand off to a
 * worker thread without re-deriving the layout.
 */
export function buildTicketVrfInputs(
  entropy: EntropyHash,
  ticketsPerValidator: number,
): { inputsData: Uint8Array; vrfInputDataLen: number } {
  const vrfInputParts: Uint8Array[] = [];
  for (let attempt = 0; attempt < ticketsPerValidator; attempt++) {
    vrfInputParts.push(BytesBlob.blobFromParts([JAM_TICKET_SEAL, entropy.raw, Uint8Array.of(attempt)]).raw);
  }
  return {
    inputsData: BytesBlob.blobFromParts(vrfInputParts).raw,
    vrfInputDataLen: JAM_TICKET_SEAL.length + entropy.length + 1,
  };
}

/**
 * Parse the raw output of `batchGenerateRingVrfForValidators` into per-validator
 * ticket lists. Records are ordered validator-major, then attempt-major; each
 * record is `status byte || signature`. A malformed batch yields a single error
 * byte. Exposed so the worker-pool path can parse a worker's raw result.
 */
export function parseTicketsBatchOutput(
  result: Uint8Array,
  numValidators: number,
  ticketsPerValidator: number,
): Result<SignedTicket[][], null> {
  const perValidator: SignedTicket[][] = [];
  let offset = 0;
  for (let v = 0; v < numValidators; v++) {
    const tickets: SignedTicket[] = [];
    for (let attempt = 0; attempt < ticketsPerValidator; attempt++) {
      if (result[offset] === ResultValues.Error) {
        return Result.error(null, () => `Ring VRF proof generation failed for validator ${v}, attempt ${attempt}`);
      }
      const signature = Bytes.fromBlob(
        new Uint8Array(result.subarray(offset + 1, offset + GENERATE_RESULT_ENTRY_LENGTH)),
        BANDERSNATCH_PROOF_BYTES,
      ).asOpaque();
      tickets.push(SignedTicket.create({ attempt: tryAsTicketAttempt(attempt), signature }));
      offset += GENERATE_RESULT_ENTRY_LENGTH;
    }
    perValidator.push(tickets);
  }

  return Result.ok(perValidator);
}
