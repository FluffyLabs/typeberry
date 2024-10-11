import type { BandersnatchRingSignature } from "@typeberry/block";
import { TicketEnvelope, type TicketsExtrinsic, ticketsExtrinsicCodec } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from ".";

const ticketEnvelopeFromJson = json.object<TicketEnvelope>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchRingSignature),
  },
  (x) => new TicketEnvelope(x.attempt, x.signature),
);

export const ticketsExtrinsicFromJson = json.array(ticketEnvelopeFromJson);

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  runCodecTest(ticketsExtrinsicCodec, test, file);
}
