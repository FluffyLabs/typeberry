import type { EntropyHash, ValidatorIndex } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { BandersnatchKey } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { type Opaque, Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm/index.js";
import { JAM_TICKET_SEAL } from "./constants.js";

const RESULT_INDEX = 0 as const;

/** Bandersnatch VRF signature size */
export const BANDERSNATCH_VRF_SIGNATURE_BYTES = 96;
export type BANDERSNATCH_VRF_SIGNATURE_BYTES = typeof BANDERSNATCH_VRF_SIGNATURE_BYTES;

/** Bandersnatch ring commitment size */
export const BANDERSNATCH_RING_ROOT_BYTES = 144;
export type BANDERSNATCH_RING_ROOT_BYTES = typeof BANDERSNATCH_RING_ROOT_BYTES;

/** Bandersnatch proof size */
export const BANDERSNATCH_PROOF_BYTES = 784;
export type BANDERSNATCH_PROOF_BYTES = typeof BANDERSNATCH_PROOF_BYTES;

/**
 * Bandersnatch ring commitment
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/0da8000dc200?v=0.6.7
 */
export type BandersnatchRingRoot = Opaque<Bytes<BANDERSNATCH_RING_ROOT_BYTES>, "BandersnatchRingRoot">;

/**
 * Potentially valid Bandersnatch signature.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/082300082300?v=0.6.7
 */
export type BandersnatchVrfSignature = Opaque<Bytes<BANDERSNATCH_VRF_SIGNATURE_BYTES>, "BandersnatchVrfSignature">;

/**
 * Potentially valid Bandersnatch RingVRF proof of knowledge.
 *
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/082d00083a00?v=0.6.7
 */
export type BandersnatchProof = Opaque<Bytes<BANDERSNATCH_PROOF_BYTES>, "BandersnatchRingSignature">;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

// TODO [ToDr] We export the entire object to allow mocking in tests.
// Ideally we would just export functions and figure out how to mock
// properly in ESM.
export default {
  verifySeal,
  verifyTickets,
  getRingCommitment,
};

async function verifySeal(
  bandersnatch: BandernsatchWasm,
  validators: BandersnatchKey[],
  authorIndex: ValidatorIndex,
  signature: BandersnatchVrfSignature,
  payload: BytesBlob,
  encodedUnsealedHeader: BytesBlob,
): Promise<Result<EntropyHash, null>> {
  const keys = BytesBlob.blobFromParts(validators.map((x) => x.raw)).raw;
  const sealResult = await bandersnatch.verifySeal(
    keys,
    authorIndex,
    signature.raw,
    payload.raw,
    encodedUnsealedHeader.raw,
  );

  if (sealResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null);
  }

  return Result.ok(Bytes.fromBlob(sealResult.subarray(1), HASH_SIZE).asOpaque());
}

async function getRingCommitment(
  bandersnatch: BandernsatchWasm,
  validators: BandersnatchKey[],
): Promise<Result<BandersnatchRingRoot, null>> {
  const keys = BytesBlob.blobFromParts(validators.map((x) => x.raw)).raw;
  const commitmentResult = await bandersnatch.getRingCommitment(keys);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null);
  }

  return Result.ok(Bytes.fromBlob(commitmentResult.subarray(1), BANDERSNATCH_RING_ROOT_BYTES).asOpaque());
}

async function verifyTickets(
  bandersnatch: BandernsatchWasm,
  validators: readonly BandersnatchKey[],
  tickets: readonly SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; entropyHash: EntropyHash }[]> {
  const contextLength = entropy.length + JAM_TICKET_SEAL.length + 1;

  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) =>
        BytesBlob.blobFromParts([ticket.signature.raw, JAM_TICKET_SEAL, entropy.raw, Uint8Array.of(ticket.attempt)])
          .raw,
    ),
  ).raw;

  const keys = BytesBlob.blobFromParts(validators.map((x) => x.raw)).raw;
  try {
    const verificationResult = await bandersnatch.batchVerifyTicket(keys, ticketsData, contextLength);
    return Array.from(BytesBlob.blobFrom(verificationResult).chunks(33)).map((result) => ({
      isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
      entropyHash: Bytes.fromBlob(result.raw.subarray(1, 33), HASH_SIZE).asOpaque(),
    }));
  } catch (e) {
    // TODO [ToDr] Temporary workaround for failing verification.
    // Instead we should handle that in the wasm library.
    // See stateTransitionFuzzed tests for details.
    if (`${e}` === "RuntimeError: unreachable") {
      return Array.from({ length: tickets.length }, () => ({
        isValid: false,
        entropyHash: Bytes.zero(HASH_SIZE).asOpaque(),
      }));
    }
    throw e;
  }
}
