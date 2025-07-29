import { describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { Compatibility, GpVersion, deepEqual } from "@typeberry/utils";
import { ServiceAccountInfo } from "./service.js";

const encodedTestInfo = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
  ? "0x0101010101010101010101010101010101010101010101010101010101010101809698000000000064000000000000000a000000000000000a00000000000000ff0000000000000003000000060000000b0000000f000000"
  : "0x0101010101010101010101010101010101010101010101010101010101010101809698000000000064000000000000000a000000000000000a0000000000000003000000";

const testInfo = ServiceAccountInfo.create({
  codeHash: Bytes.fill(HASH_SIZE, 1).asOpaque(),
  balance: tryAsU64(10_000_000n),
  accumulateMinGas: tryAsServiceGas(100),
  onTransferMinGas: tryAsServiceGas(10),
  storageUtilisationBytes: tryAsU64(10),
  storageUtilisationCount: tryAsU32(3),
  gratisStorageBytes: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsU64(255) : tryAsU64(0),
  created: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsTimeSlot(6) : tryAsTimeSlot(0),
  lastAccumulation: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsTimeSlot(11) : tryAsTimeSlot(0),
  parentService: Compatibility.isGreaterOrEqual(GpVersion.V0_6_7) ? tryAsServiceId(15) : tryAsServiceId(0),
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

  it("should correctly calculate threshold", () => {
    const threshold = ServiceAccountInfo.calculateThresholdBalance(
      testInfo.storageUtilisationCount,
      testInfo.storageUtilisationBytes,
      testInfo.gratisStorageBytes,
    );
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      deepEqual(threshold, tryAsU64(0));
    } else {
      deepEqual(threshold, tryAsU64(140));
    }
  });
});
