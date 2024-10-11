import assert from "node:assert";
import fs from "node:fs";
import { type AssurancesExtrinsic, AvailabilityAssurance, assurancesExtrinsicCodec } from "@typeberry/block/assurances";
import { CodecContext } from "@typeberry/block/context";
import { BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32, fromJson } from ".";
import type { JsonObject } from "../../json-format";

const availabilityAssuranceFromJson = json.object<JsonObject<AvailabilityAssurance>, AvailabilityAssurance>(
  {
    anchor: bytes32(),
    bitfield: json.fromString((v) => {
      const ctx = new CodecContext();
      const bytes = Math.ceil(ctx.coresCount / 8) * 8;
      return BitVec.fromBytes(Bytes.parseBytes(v, bytes / 8), bytes);
    }),
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ anchor, bitfield, validator_index, signature }) =>
    new AvailabilityAssurance(anchor, bitfield, validator_index, signature),
);

export const assurancesExtrinsicFromJson = json.array(availabilityAssuranceFromJson);

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(assurancesExtrinsicCodec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(assurancesExtrinsicCodec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
