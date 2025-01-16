import type { BandersnatchRingRoot, EntropyHash } from "@typeberry/block";
import type { SignedTicket } from "@typeberry/block/tickets";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { Result } from "@typeberry/utils";
import { ring_commitment, verify_safrole, verify_ticket } from "bandersnatch-wasm/pkg";

export async function verifyBandersnatch(): Promise<boolean> {
  // TODO [ToDr] make it async (run inside a worker)
  return verify_safrole();
}

export async function getRingCommitment(keys: Uint8Array): Promise<Result<BandersnatchRingRoot, undefined>> {
  const commitmentResult = await ring_commitment(keys);

  if (commitmentResult[0] === 1) {
    return Result.error(undefined);
  }

  return Result.ok(BytesBlob.blobFrom(commitmentResult.subarray(1)).asOpaque());
}
const X_T = BytesBlob.blobFromString("jam_ticket_seal").raw;

export async function verifyTickets(
  keys: Uint8Array,
  tickets: SignedTicket[],
  entropy: EntropyHash,
): Promise<{ isValid: boolean; entropyHash: Bytes<32> }[]> {
  const contextLength = entropy.length + X_T.length + 1;
  const ticketsData = BytesBlob.blobFromParts(
    tickets.map(
      (ticket) =>
        BytesBlob.blobFromParts([ticket.signature.raw, X_T, entropy.raw, new Uint8Array([ticket.attempt])]).raw,
    ),
  ).raw;
  const verificationResult = await verify_ticket(keys, ticketsData, contextLength);

  return BytesBlob.blobFrom(verificationResult)
    .chunks(33)
    .map((result) => ({
      isValid: result.raw[0] === 0,
      entropyHash: BytesBlob.blobFrom(result.raw.subarray(1, 33)).asOpaque(),
    }));
}
