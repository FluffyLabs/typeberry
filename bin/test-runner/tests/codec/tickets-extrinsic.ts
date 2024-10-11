import assert from "node:assert";
import fs from "node:fs";
import type { BandersnatchRingSignature } from "@typeberry/block";
import { CodecContext } from "@typeberry/block/context";
import { TicketEnvelope, type TicketsExtrinsic, ticketsExtrinsicCodec } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { fromJson } from ".";

const ticketEnvelopeFromJson = json.object<TicketEnvelope>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, 784) as BandersnatchRingSignature),
  },
  (x) => new TicketEnvelope(x.attempt, x.signature),
);

export const ticketsExtrinsicFromJson = json.array(ticketEnvelopeFromJson);

export async function runTicketsExtrinsicTest(test: TicketsExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(ticketsExtrinsicCodec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(ticketsExtrinsicCodec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
