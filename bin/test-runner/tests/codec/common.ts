import assert from "node:assert";
import fs from "node:fs";
import type { Ed25519Signature } from "@typeberry/block";
import type { TicketAttempt } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { type Codec, Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";

export namespace fromJson {
  export const bytes32 = <T extends Bytes<32>>() => json.fromString<T>((v) => Bytes.parseBytes(v, 32).asOpaque());
  export const bytes32NoPrefix = <T extends Bytes<32>>() =>
    json.fromString<T>((v) => Bytes.parseBytesNoPrefix(v, 32).asOpaque());

  export const ed25519Signature = json.fromString<Ed25519Signature>((v) => Bytes.parseBytes(v, 64).asOpaque());

  export const ticketAttempt = json.fromNumber((v) => {
    if (v !== 0 && v !== 1 && v !== 2) {
      throw new Error("Invalid TicketAttempt value.");
    }
    return v as TicketAttempt;
  }) as FromJson<TicketAttempt>;

  export const uint8Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new Uint8Array(v);
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  export const bigUint64Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new BigUint64Array(v.map((x) => BigInt(x)));
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  export const bigUint64 = json.fromAny((v) => BigInt(v as bigint));
}

export function runCodecTest<T>(codec: Codec<T>, test: T, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(codec, test, tinyChainSpec);
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.blobFrom(encoded).toString());

  const decoded = Decoder.decodeObject(codec, encoded, tinyChainSpec);
  assert.deepStrictEqual(decoded, test);
}
