import { Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { TicketEnvelope } from "@typeberry/safrole";
import type { BandersnatchRingSignature } from "@typeberry/safrole/crypto";
import { fromJson, logger } from ".";

const TicketEnvelopeFromJson = json.object<TicketEnvelope>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchRingSignature),
  },
  (x) => Object.assign(new TicketEnvelope(), x),
);

export type TicketsExtrinsic = KnownSizeArray<TicketEnvelope, "Size: 0..16">;
export const TicketsExtrinsicFromJson = json.array(TicketEnvelopeFromJson);

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
