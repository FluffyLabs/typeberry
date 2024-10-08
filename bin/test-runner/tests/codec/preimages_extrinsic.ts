import { BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { type ServiceId, logger } from ".";

class Preimage {
  static fromJson = json.object<Preimage>(
    {
      requester: "number",
      blob: json.fromString(BytesBlob.parseBlob),
    },
    (x) => Object.assign(new Preimage(), x),
  );

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
