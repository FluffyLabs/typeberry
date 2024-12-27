import { type AssurancesExtrinsic, AvailabilityAssurance, assurancesExtrinsicCodec } from "@typeberry/block/assurances";
import { BitVec, Bytes } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";
import type { JsonObject } from "../../json-format";
import { fromJson, runCodecTest } from "./common";

const getAvailabilityAssuranceFromJson = (ctx: ChainSpec) =>
  json.object<JsonObject<AvailabilityAssurance>, AvailabilityAssurance>(
    {
      anchor: fromJson.bytes32(),
      bitfield: json.fromString((v) => {
        const bytes = Math.ceil(ctx.coresCount / 8) * 8;
        return BitVec.fromBytes(Bytes.parseBytes(v, bytes / 8), bytes);
      }),
      validator_index: "number",
      signature: fromJson.ed25519Signature,
    },
    ({ anchor, bitfield, validator_index, signature }) =>
      new AvailabilityAssurance(anchor, bitfield, validator_index, signature),
  );

export const getAssurancesExtrinsicFromJson = (ctx: ChainSpec) => json.array(getAvailabilityAssuranceFromJson(ctx));

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  runCodecTest(assurancesExtrinsicCodec, test, file);
}
