import type { BandersnatchProof } from "@typeberry/block";
import { SignedTicket, type TicketsExtrinsic, ticketsExtrinsicCodec } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from "./common";

const ticketEnvelopeFromJson = json.object<SignedTicket>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchProof),
  },
  (x) => new SignedTicket(x.attempt, x.signature),
);

export const ticketsExtrinsicFromJson = json.array(ticketEnvelopeFromJson);

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  runCodecTest(ticketsExtrinsicCodec, test, file);
}
