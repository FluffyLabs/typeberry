import { describe, it } from "node:test";
import { tryAsServiceGas } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { deepEqual } from "@typeberry/utils";
import { ServiceAccountInfo } from "./service.js";

const encodedTestInfo =
  "0x0101010101010101010101010101010101010101010101010101010101010101809698000000000064000000000000000a000000000000000a0000000000000003000000";

const testInfo = ServiceAccountInfo.create({
  codeHash: Bytes.fill(HASH_SIZE, 1).asOpaque(),
  balance: tryAsU64(10_000_000n),
  accumulateMinGas: tryAsServiceGas(100),
  onTransferMinGas: tryAsServiceGas(10),
  storageUtilisationBytes: tryAsU64(10),
  storageUtilisationCount: tryAsU32(3),
});

describe("Service Account Info", () => {
  it("should encode service account info", () => {
    const encoded = Encoder.encodeObject(ServiceAccountInfo.Codec, testInfo);

    deepEqual(encoded.toString(), encodedTestInfo);
  });

  it("should decode service account info", () => {
    const accountInfo = Decoder.decodeObject(ServiceAccountInfo.Codec, BytesBlob.parseBlob(encodedTestInfo));

    deepEqual(accountInfo, testInfo);
  });
});
