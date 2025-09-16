import type { EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { BandersnatchKey } from "@typeberry/crypto";
import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchRingRoot,
  type BandersnatchVrfSignature,
} from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm/index.js";
import { JAM_TICKET_SEAL } from "./constants.js";

const RESULT_INDEX = 0 as const;

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
  numberOfValidators: number,
  epochRoot: BandersnatchRingRoot,
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

  const verificationResult = await bandersnatch.batchVerifyTicket(
    numberOfValidators,
    epochRoot.raw,
    ticketsData,
    contextLength,
  );
  return Array.from(BytesBlob.blobFrom(verificationResult).chunks(33)).map((result) => ({
    isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
    entropyHash: Bytes.fromBlob(result.raw.subarray(1, 33), HASH_SIZE).asOpaque(),
  }));
}
