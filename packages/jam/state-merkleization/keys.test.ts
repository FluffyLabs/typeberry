import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { StateKeyIdx, stateKeys } from "./keys.js";

describe("State Serialization / keys", () => {
  it("should construct index key", () => {
    const alpha = stateKeys.index(StateKeyIdx.Alpha);
    const delta = stateKeys.index(StateKeyIdx.Delta);
    const xi = stateKeys.index(StateKeyIdx.Xi);

    assert.strictEqual(`${alpha}`, "0x0100000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${delta}`, "0xff00000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${xi}`, "0x0f00000000000000000000000000000000000000000000000000000000000000");
  });

  it("should construct key for service info", () => {
    const a = stateKeys.serviceInfo(tryAsServiceId(2 ** 32 - 1));
    const b = stateKeys.serviceInfo(tryAsServiceId(2));
    const c = stateKeys.serviceInfo(tryAsServiceId(2 ** 16));
    const d = stateKeys.serviceInfo(tryAsServiceId(2 ** 16 - 1));

    assert.strictEqual(`${a}`, "0xffff00ff00ff00ff000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${b}`, "0xff02000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${c}`, "0xff00000000010000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${d}`, "0xffff00ff00000000000000000000000000000000000000000000000000000000");
  });

  it("should construct a key for service state", () => {
    const a = stateKeys.serviceStorage(tryAsServiceId(0xbbbb_bbbb), EXAMPLE_HASH.asOpaque());
    const expectedKey = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? "0xbb98bb4bbb5bbbf04624e8575cf0ddc40ad4d73ae8dcbd527b3143b76e6689f6"
      : "0xbbffbbffbbffbbff00112233445566778899aabbccddeeff0011223344556677";
    assert.strictEqual(`${a}`, expectedKey);
  });

  it("should construct a key for service preimage", () => {
    const a = stateKeys.servicePreimage(tryAsServiceId(0xbbbb_bbbb), EXAMPLE_HASH.asOpaque());
    const expectedKey = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? "0xbb9ebbb1bb8dbb02b980a74e4be74b55435d6030e74652c9cc6fe523b4c866f5"
      : "0xbbfebbffbbffbbff112233445566778899aabbccddeeff001122334455667788";
    assert.strictEqual(`${a}`, expectedKey);
  });

  it("should construct a key for service lookup history", () => {
    const a = stateKeys.serviceLookupHistory(
      tryAsServiceId(0xbbbb_bbbb),
      EXAMPLE_HASH.asOpaque(),
      tryAsU32(0xdeadbeef),
    );
    const expectedKey = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? "0xbb48bb92bbc3bb5ff7692d2e8e65b37d5df58917217dbb72b1d2c0cdf75079e9"
      : "0xbbefbbbebbadbbde9e850fdf24cf9f91a71a6862537040fabeec35734d63fbea";
    assert.strictEqual(`${a}`, expectedKey);
  });
});

const EXAMPLE_HASH = Bytes.parseBytes("0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", HASH_SIZE);
