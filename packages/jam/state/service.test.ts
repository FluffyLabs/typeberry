import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { Compatibility, deepEqual, GpVersion } from "@typeberry/utils";
import { ServiceAccountInfo } from "./service.js";

const encodedTestInfo = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
  ? "0x000101010101010101010101010101010101010101010101010101010101010101809698000000000064000000000000000a000000000000000a00000000000000050000000000000003000000060000000b0000000f000000"
  : "0x0101010101010101010101010101010101010101010101010101010101010101809698000000000064000000000000000a000000000000000a00000000000000050000000000000003000000060000000b0000000f000000";
const testInfo = ServiceAccountInfo.create({
  codeHash: Bytes.fill(HASH_SIZE, 1).asOpaque(),
  balance: tryAsU64(10_000_000n),
  accumulateMinGas: tryAsServiceGas(100),
  onTransferMinGas: tryAsServiceGas(10),
  storageUtilisationBytes: tryAsU64(10),
  storageUtilisationCount: tryAsU32(3),
  gratisStorage: tryAsU64(5),
  created: tryAsTimeSlot(6),
  lastAccumulation: tryAsTimeSlot(11),
  parentService: tryAsServiceId(15),
  version: tryAsU64(0),
});

describe("Service: Account Info", () => {
  it("should encode service account info", () => {
    const encoded = Encoder.encodeObject(ServiceAccountInfo.Codec, testInfo);

    deepEqual(encoded.toString(), encodedTestInfo);
  });

  it("should decode service account info", () => {
    const accountInfo = Decoder.decodeObject(ServiceAccountInfo.Codec, BytesBlob.parseBlob(encodedTestInfo));

    deepEqual(accountInfo, testInfo);
  });
});

describe("Service: Calculate Threshold Balance", () => {
  it("should correctly calculate threshold for a test service", () => {
    const threshold = ServiceAccountInfo.calculateThresholdBalance(
      testInfo.storageUtilisationCount,
      testInfo.storageUtilisationBytes,
      testInfo.gratisStorage,
    );
    deepEqual(threshold, tryAsU64(135));
  });

  it("should handle very high threshold balance", () => {
    const threshold = ServiceAccountInfo.calculateThresholdBalance(
      tryAsU32(2 ** 32 - 1),
      tryAsU64(2n ** 64n - 1n),
      tryAsU64(0),
    );
    assert.deepStrictEqual(threshold, tryAsU64(2n ** 64n - 1n));
  });

  it("should handle very low threshold balance", () => {
    const threshold = ServiceAccountInfo.calculateThresholdBalance(tryAsU32(0), tryAsU64(0), tryAsU64(2n ** 64n - 1n));

    assert.deepStrictEqual(threshold, tryAsU64(0n));
  });
});
