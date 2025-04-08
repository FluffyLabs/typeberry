import type { BandersnatchRingRoot, EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets";
import { BytesBlob } from "@typeberry/bytes";
import { Result } from "@typeberry/utils";
import type { BandernsatchWasm } from "./bandersnatch-wasm";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

export async function getRingCommitment(
  bandersnatch: BandernsatchWasm,
  keys: Uint8Array,
): Promise<Result<BandersnatchRingRoot, null>> {
  const commitmentResult = await bandersnatch.getRingCommitment(keys);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(null);
  }

  return Result.ok(BytesBlob.blobFrom(commitmentResult.subarray(1)).asOpaque());
}

const X_T = BytesBlob.blobFromString("jam_ticket_seal").raw;

export async function verifyTickets(
  bandersnatch: BandernsatchWasm,
  keys: Uint8Array,
  tickets: SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; entropyHash: EntropyHash }[]> {
  const contextLength = entropy.length + X_T.length + 1;

  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) => BytesBlob.blobFromParts([ticket.signature.raw, X_T, entropy.raw, Uint8Array.of(ticket.attempt)]).raw,
    ),
  ).raw;

  const verificationResult = await bandersnatch.verifyTicket(keys, ticketsData, contextLength);

  return Array.from(BytesBlob.blobFrom(verificationResult).chunks(33)).map((result) => ({
    isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
    entropyHash: BytesBlob.blobFrom(result.raw.subarray(1, 33)).asOpaque(),
  }));
}
