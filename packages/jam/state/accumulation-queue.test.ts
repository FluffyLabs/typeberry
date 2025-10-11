import { describe, it } from "node:test";
import { reencodeAsView } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { deepEqual } from "@typeberry/utils";
import { accumulationQueueCodec } from "./accumulation-queue.js";

describe("Accumulation queue", () => {
  it("should decode empty accumulation queue view", () => {
    const spec = tinyChainSpec;
    const encoded = Bytes.zero(spec.epochLength);

    const decoded = Decoder.decodeObject(accumulationQueueCodec, encoded, spec);
    const decodedView = Decoder.decodeObject(accumulationQueueCodec.View, encoded, spec);
    const reencoded = reencodeAsView(accumulationQueueCodec, decoded, spec);

    deepEqual(decodedView.encoded(), encoded);
    deepEqual(reencoded.encoded(), encoded);
  });
});
