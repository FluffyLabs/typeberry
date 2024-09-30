import { BitVec, Bytes } from "@typeberry/bytes";
import {
  type Ed25519Signature,
  type HeaderHash,
  type ValidatorIndex,
  bytes32,
  ed25519SignatureFromJson,
  logger,
} from ".";
import { ARRAY, FROM_NUMBER, FROM_STRING, type FromJson } from "../../json-parser";

class AvailAssurance {
  static fromJson: FromJson<AvailAssurance> = {
    anchor: bytes32<HeaderHash>(),
    // TODO [ToDr] does the string contain some prefix or do we KNOW the length?
    bitfield: FROM_STRING((v) => BitVec.fromBytes(Bytes.parseBytes(v, 1), 8)),
    validator_index: FROM_NUMBER((n) => n as ValidatorIndex),
    signature: ed25519SignatureFromJson,
  };

  anchor!: HeaderHash;
  bitfield!: BitVec;
  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;
}
export type AssurancesExtrinsic = AvailAssurance[];
export const AssurancesExtrinsicFromJson = ARRAY(AvailAssurance.fromJson);

export async function runAssurancesExtrinsicTest(test: AssurancesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
