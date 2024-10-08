import assert from "node:assert";
import fs from "node:fs";
import { type AssurancesExtrinsic, AvailabilityAssurance, assurancesExtrinsicCodec } from "@typeberry/block/assurances";
import { BitVec, Bytes } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32, fromJson } from ".";
import type { JsonObject } from "../../json-format";

const availabilityAssuranceFromJson = json.object<JsonObject<AvailabilityAssurance>, AvailabilityAssurance>(
  {
    anchor: bytes32(),
    // TODO [ToDr] does the string contain some prefix or do we KNOW the length?
    bitfield: json.fromString((v) => BitVec.fromBytes(Bytes.parseBytes(v, 1), 8)),
    validator_index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ anchor, bitfield, validator_index, signature }) =>
    new AvailabilityAssurance(anchor, bitfield, validator_index, signature),
);

export const assurancesExtrinsicFromJson = json.array(availabilityAssuranceFromJson);

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const decoded = Decoder.decodeObject(assurancesExtrinsicCodec, encoded);

  assert.deepStrictEqual(decoded, test);
}
