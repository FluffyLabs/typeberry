import { BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { type ServiceId, logger } from ".";

class Preimage {
  static fromJson: FromJson<Preimage> = {
    requester: json.castNumber(),
    blob: json.fromString(BytesBlob.parseBlob),
  };

  requester!: ServiceId;
  blob!: BytesBlob;

  private constructor() {}
}

export type PreimagesExtrinsic = Preimage[];
export const PreimagesExtrinsicFromJson = json.array(Preimage.fromJson);

export async function runPreimagesExtrinsicTest(test: PreimagesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
