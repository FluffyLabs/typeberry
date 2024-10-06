import { BitVec, Bytes } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { type Ed25519Signature, type HeaderHash, type ValidatorIndex, bytes32, fromJson, logger } from ".";

class AvailAssurance {
  static fromJson: FromJson<AvailAssurance> = {
    anchor: bytes32<HeaderHash>(),
    // TODO [ToDr] does the string contain some prefix or do we KNOW the length?
    bitfield: json.fromString((v) => BitVec.fromBytes(Bytes.parseBytes(v, 1), 8)),
    validator_index: json.castNumber(),
    signature: fromJson.ed25519Signature,
  };

  anchor!: HeaderHash;
  bitfield!: BitVec;
  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}
export type AssurancesExtrinsic = AvailAssurance[];
export const AssurancesExtrinsicFromJson = json.array(AvailAssurance.fromJson);

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
