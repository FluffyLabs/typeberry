import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { StateKey } from "./keys";
import { serialize } from "./serialize";

type TestCase = [string, { key: StateKey }, string];

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
      serialize.serviceStorage(tryAsServiceId(0xeeee), Bytes.fill(HASH_SIZE, 15).asOpaque()),
      "0xeeffeeff00ff00ff0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    ],
    [
      "preimage",
      serialize.servicePreimages(tryAsServiceId(0xeeee), Bytes.fill(HASH_SIZE, 15).asOpaque()),
      "0xeefeeeff00ff00ff0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f",
    ],
    [
      "lookup history",
      serialize.serviceLookupHistory(tryAsServiceId(0xeeee), Bytes.fill(HASH_SIZE, 15).asOpaque(), tryAsU32(0xdddd)),
      "0xeeddeedd00000000a5dcc154c266f9eda35710023afa6d947cb3cae83848f32b",
    ],
  ];

  for (const [name, entry, expectedKey] of cases) {
    it(`Should construct correct key for ${name}`, () => {
      assert.strictEqual(entry.key.toString(), expectedKey);
    });
  }
});
