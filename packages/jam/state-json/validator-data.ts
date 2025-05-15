import { BLS_KEY_BYTES } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { VALIDATOR_META_BYTES, ValidatorData } from "@typeberry/state";

export const validatorDataFromJson = json.object<ValidatorData>(
  {
    ed25519: fromJson.bytes32(),
    bandersnatch: fromJson.bytes32(),
    bls: json.fromString((v) => Bytes.parseBytes(v, BLS_KEY_BYTES).asOpaque()),
    metadata: json.fromString((v) => Bytes.parseBytes(v, VALIDATOR_META_BYTES)),
  },
  ({ ed25519, bandersnatch, bls, metadata }) => ValidatorData.create({ bandersnatch, ed25519, bls, metadata }),
);
