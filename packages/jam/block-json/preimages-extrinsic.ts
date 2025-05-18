import { Preimage } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";

const preimageFromJson = json.object<Preimage>(
  {
    requester: "number",
    blob: json.fromString(BytesBlob.parseBlob),
  },
  ({ requester, blob }) => Preimage.create({ requester, blob }),
);

export const preimagesExtrinsicFromJson = json.array(preimageFromJson);
