import type { BandersnatchRingRoot, EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { Result } from "@typeberry/utils";
import { ring_commitment, verify_ticket } from "bandersnatch-wasm/pkg";

const RESULT_INDEX = 0 as const;

enum ResultValues {
  Ok = 0,
  Error = 1,
}

export async function getRingCommitment(keys: Uint8Array): Promise<Result<BandersnatchRingRoot, null>> {
  const commitmentResult = await ring_commitment(keys);

  if (commitmentResult[RESULT_INDEX] === ResultValues.Error) {
    return Result.error(undefined);
  }

  return Result.ok(BytesBlob.blobFrom(commitmentResult.subarray(1)).asOpaque());
}

const X_T = BytesBlob.blobFromString("jam_ticket_seal").raw;

export async function verifyTickets(
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

  const verificationResult = await verify_ticket(keys, ticketsData, contextLength);

  return BytesBlob.blobFrom(verificationResult)
    .chunks(33)
    .map((result) => ({
      isValid: result.raw[RESULT_INDEX] === ResultValues.Ok,
      entropyHash: BytesBlob.blobFrom(result.raw.subarray(1, 33)).asOpaque(),
    }));
}
