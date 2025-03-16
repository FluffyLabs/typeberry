import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { StateEntry } from "./entries";
import { keys } from "./keys";

describe("State Serialization / keys", () => {
  it("should construct index key", () => {
    const alpha = keys.index(StateEntry.Alpha);
    const delta = keys.index(StateEntry.Delta);
    const xi = keys.index(StateEntry.Xi);

    assert.strictEqual(`${alpha}`, "0x0100000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${delta}`, "0xff00000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${xi}`, "0x0f00000000000000000000000000000000000000000000000000000000000000");
  });

  it("should construct key for service info", () => {
    const a = keys.serviceInfo(tryAsServiceId(2 ** 32 - 1));
    const b = keys.serviceInfo(tryAsServiceId(2));
    const c = keys.serviceInfo(tryAsServiceId(2 ** 16));
    const d = keys.serviceInfo(tryAsServiceId(2 ** 16 - 1));

    assert.strictEqual(`${a}`, "0xffff00ff00ff00ff000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${b}`, "0xff02000000000000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${c}`, "0xff00000000010000000000000000000000000000000000000000000000000000");
    assert.strictEqual(`${d}`, "0xffff00ff00000000000000000000000000000000000000000000000000000000");
  });

  it("should construct a key for service state", () => {
    const a = keys.serviceState(tryAsServiceId(0xbbbb_bbbb), EXAMPLE_HASH.asOpaque());
    assert.strictEqual(`${a}`, "0xbbffbbffbbffbbff00112233445566778899aabbccddeeff0011223344556677");
  });

  it("should construct a key for service preimage", () => {
    const a = keys.servicePreimage(tryAsServiceId(0xbbbb_bbbb), EXAMPLE_HASH.asOpaque());
    assert.strictEqual(`${a}`, "0xbbfebbffbbffbbff112233445566778899aabbccddeeff001122334455667788");
  });

  it("should construct a key for service lookup history", () => {
    const a = keys.serviceLookupHistory(tryAsServiceId(0xbbbb_bbbb), EXAMPLE_HASH.asOpaque(), tryAsU32(0xdeadbeef));
    assert.strictEqual(`${a}`, "0xbbefbbbebbadbbde9e850fdf24cf9f91a71a6862537040fabeec35734d63fbea");
  });
});

const EXAMPLE_HASH = Bytes.parseBytes("0x00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", HASH_SIZE);
