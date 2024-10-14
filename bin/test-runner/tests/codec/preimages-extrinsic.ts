import { Preimage, type PreimagesExtrinsic, preimagesExtrinsicCodec } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { runCodecTest } from "./common";

const preimageFromJson = json.object<Preimage>(
  {
    requester: "number",
    blob: json.fromString(BytesBlob.parseBlob),
  },
  ({ requester, blob }) => new Preimage(requester, blob),
);

export const preimagesExtrinsicFromJson = json.array(preimageFromJson);

export async function runPreimagesExtrinsicTest(test: PreimagesExtrinsic, file: string) {
  runCodecTest(preimagesExtrinsicCodec, test, file);
}
