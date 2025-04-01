import type { BandersnatchKey, BandersnatchRingRoot, BandersnatchVrfSignature, EntropyHash, ValidatorIndex } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import {HASH_SIZE} from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import { ring_commitment, batch_verify_tickets, verify_seal } from "bandersnatch-wasm/pkg";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

export async function verifySeal(
  validators: BandersnatchKey[],
  author_index: ValidatorIndex,
  signature: BandersnatchVrfSignature,
  payload: BytesBlob,
  encodedUnsealedHeader: BytesBlob,
): Promise<Result<EntropyHash, null>> {

  const keys = BytesBlob.blobFromParts(validators.map(x => x.raw)).raw;
  const sealResult = verify_seal(
    keys,
    author_index,
    signature.raw,
    payload.raw,
    encodedUnsealedHeader.raw,
  );

  if (sealResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null);
  }

  return Result.ok(Bytes.fromBlob(sealResult.subarray(1), HASH_SIZE).asOpaque());
}

export async function getRingCommitment(validators: BandersnatchKey[]): Promise<Result<BandersnatchRingRoot, null>> {
  const keys = BytesBlob.blobFromParts(validators.map(x => x.raw)).raw;
  const commitmentResult = ring_commitment(keys);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null);
  }

  return Result.ok(BytesBlob.blobFrom(commitmentResult.subarray(1)).asOpaque());
}

const X_T = BytesBlob.blobFromString("jam_ticket_seal").raw;

export async function verifyTickets(
  validators: BandersnatchKey[],
  tickets: SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; entropyHash: EntropyHash }[]> {
  const contextLength = entropy.length + X_T.length + 1;

  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) => BytesBlob.blobFromParts([ticket.signature.raw, X_T, entropy.raw, Uint8Array.of(ticket.attempt)]).raw,
    ),
  ).raw;

  const keys = BytesBlob.blobFromParts(validators.map(x => x.raw)).raw;
  const verificationResult = batch_verify_tickets(keys, ticketsData, contextLength);

  return Array.from(BytesBlob.blobFrom(verificationResult).chunks(33)).map((result) => ({
    isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
    entropyHash: BytesBlob.blobFrom(result.raw.subarray(1, 33)).asOpaque(),
  }));
}
