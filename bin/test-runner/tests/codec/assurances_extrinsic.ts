import { BitVec, Bytes } from "@typeberry/bytes";
import type { KnownSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { type Ed25519Signature, bytes32, fromJson, logger } from ".";
import {HeaderHash, ValidatorIndex} from "@typeberry/block";

class AvailabilityAssurance {
  static fromJson = json.object<AvailabilityAssurance>(
    {
      anchor: bytes32(),
      // TODO [ToDr] does the string contain some prefix or do we KNOW the length?
      bitfield: json.fromString((v) => BitVec.fromBytes(Bytes.parseBytes(v, 1), 8)),
      validator_index: "number",
      signature: fromJson.ed25519Signature,
    },
    (x) => Object.assign(new AvailabilityAssurance(), x),
  );

  anchor!: HeaderHash;
  bitfield!: BitVec;
  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}
export type AssurancesExtrinsic = KnownSizeArray<AvailabilityAssurance, "0 .. ValidatorsCount">;
export const AssurancesExtrinsicFromJson = json.array(AvailabilityAssurance.fromJson);

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
