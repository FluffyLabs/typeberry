import { BitVec, Bytes } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common";

import { AvailabilityAssurance } from "@typeberry/block/assurances";
// TODO [ToDr] wrong import
import type { JsonObject } from "../../../bin/test-runner/json-format";

const getAvailabilityAssuranceFromJson = (ctx: ChainSpec) =>
  json.object<JsonObject<AvailabilityAssurance>, AvailabilityAssurance>(
    {
      anchor: fromJson.bytes32(),
      bitfield: json.fromString((v) => {
        const bytes = Math.ceil(ctx.coresCount / 8);
        return BitVec.fromBytes(Bytes.parseBytes(v, bytes), ctx.coresCount);
      }),
      validator_index: "number",
      signature: fromJson.ed25519Signature,
    },
    ({ anchor, bitfield, validator_index, signature }) =>
      new AvailabilityAssurance(anchor, bitfield, validator_index, signature),
  );

export const getAssurancesExtrinsicFromJson = (ctx: ChainSpec) => json.array(getAvailabilityAssuranceFromJson(ctx));
