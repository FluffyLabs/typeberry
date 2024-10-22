import assert from "node:assert";
import fs from "node:fs";
import type { Ed25519Signature } from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";

export namespace fromJson {
  export const bytes32 = <T extends Bytes<32>>() => json.fromString((v) => Bytes.parseBytes(v, 32) as T);

  export const ed25519Signature = json.fromString((v) => Bytes.parseBytes(v, 64) as Ed25519Signature);

  export const ticketAttempt = json.fromNumber((v) => {
    if (v !== 0 && v !== 1) {
      throw new Error("Invalid TicketAttempt value.");
    }
    return v as TicketAttempt;
  }) as FromJson<TicketAttempt>;
}

export function runCodecTest<T>(codec: Codec<T>, test: T, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(codec, test, tinyChainSpec);
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.from(encoded).toString());

  const decoded = Decoder.decodeObject(codec, encoded, tinyChainSpec);
  assert.deepStrictEqual(decoded, test);
}
