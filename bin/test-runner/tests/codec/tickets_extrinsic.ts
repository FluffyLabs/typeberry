import { Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import type { TicketEnvelope } from "@typeberry/safrole";
import type { BandersnatchRingSignature } from "@typeberry/safrole/crypto";
import { fromJson, logger } from ".";

const TicketEnvelopeFromJson: FromJson<TicketEnvelope> = {
  attempt: fromJson.ticketAttempt,
  signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchRingSignature),
};

export type TicketsExtrinsic = KnownSizeArray<TicketEnvelope, "Size: 0..16">;
export const TicketsExtrinsicFromJson = json.array(TicketEnvelopeFromJson);

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
