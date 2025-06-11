import type { EntropyHash, ValidatorIndex } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchKey,
  type BandersnatchRingRoot,
  type BandersnatchVrfSignature,
} from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm";
import { JAM_TICKET_SEAL } from "./constants";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

export async function verifySeal(
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

export async function getRingCommitment(
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

export async function verifyTickets(
  bandersnatch: BandernsatchWasm,
  validators: BandersnatchKey[],
  tickets: SignedTicket[],
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
