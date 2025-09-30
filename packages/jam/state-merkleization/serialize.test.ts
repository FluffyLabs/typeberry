import assert from "node:assert";
import { before, describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { StateKey } from "./keys.js";
import { dumpCodec, serialize } from "./serialize.js";

type TestCase = [string, { key: StateKey }, string];

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("Serialization keys", () => {
  const cases: TestCase[] = [
    ["C(1)", serialize.authPools, "0x0100000000000000000000000000000000000000000000000000000000000000"],
    ["C(2)", serialize.authQueues, "0x0200000000000000000000000000000000000000000000000000000000000000"],
    ["C(3)", serialize.recentBlocks, "0x0300000000000000000000000000000000000000000000000000000000000000"],
    ["C(4)", serialize.safrole, "0x0400000000000000000000000000000000000000000000000000000000000000"],
    ["C(5)", serialize.disputesRecords, "0x0500000000000000000000000000000000000000000000000000000000000000"],
    ["C(6)", serialize.entropy, "0x0600000000000000000000000000000000000000000000000000000000000000"],
    ["C(7)", serialize.designatedValidators, "0x0700000000000000000000000000000000000000000000000000000000000000"],
    ["C(8)", serialize.currentValidators, "0x0800000000000000000000000000000000000000000000000000000000000000"],
    ["C(9)", serialize.previousValidators, "0x0900000000000000000000000000000000000000000000000000000000000000"],
    ["C(10)", serialize.availabilityAssignment, "0x0a00000000000000000000000000000000000000000000000000000000000000"],
    ["C(11)", serialize.timeslot, "0x0b00000000000000000000000000000000000000000000000000000000000000"],
    ["C(12)", serialize.privilegedServices, "0x0c00000000000000000000000000000000000000000000000000000000000000"],
    ["C(13)", serialize.statistics, "0x0d00000000000000000000000000000000000000000000000000000000000000"],
    ["C(14)", serialize.accumulationQueue, "0x0e00000000000000000000000000000000000000000000000000000000000000"],
    ["C(15)", serialize.recentlyAccumulated, "0x0f00000000000000000000000000000000000000000000000000000000000000"],
    [
      "C(255, 0xeeee_bbbb)",
      serialize.serviceData(tryAsServiceId(0xeeee_bbbb)),
      "0xffbb00bb00ee00ee000000000000000000000000000000000000000000000000",
    ],
    [
      "state",
      serialize.serviceStorage(blake2b, tryAsServiceId(0xeeee), Bytes.fill(HASH_SIZE, 15).asOpaque()),
      "0xee4bee970050003626c718ce62e1bcfb11cc7efb46f27111c166d8b5bb04fa21",
    ],
    [
      "preimage",
      serialize.servicePreimages(blake2b, tryAsServiceId(0xeeee), Bytes.fill(HASH_SIZE, 15).asOpaque()),
      "0xeec4eef300fd00b4a04dd8ad011395b20fd8e65fc577abbf17103e293fec9a54",
    ],
    [
      "lookup history",
      serialize.serviceLookupHistory(
        blake2b,
        tryAsServiceId(0xeeee),
        Bytes.fill(HASH_SIZE, 15).asOpaque(),
        tryAsU32(0xdddd),
      ),
      "0xee4aee230054008acdb8294830cc22f321d57276978d0955a8bc33ffdd964cfb",
    ],
  ];

  for (const [name, entry, expectedKey] of cases) {
    it(`Should construct correct key for ${name}`, () => {
      assert.strictEqual(entry.key.toString(), expectedKey);
    });
  }
});

describe("Codec Descriptors / dump", () => {
  it("should just dump the bytes as-is", () => {
    const input = BytesBlob.blobFromNumbers([1, 2, 3, 4, 5]);

    const encoded = Encoder.encodeObject(dumpCodec, input);
    const decoded = Decoder.decodeObject(dumpCodec, encoded);

    assert.deepStrictEqual(decoded, input);
    assert.deepStrictEqual(encoded, input);
  });
});
