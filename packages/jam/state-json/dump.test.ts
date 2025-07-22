import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { fullStateDumpFromJson } from "./dump.js";

describe("JSON state dump", () => {
  it("should load full JSON state dump", async () => {
    const spec = tinyChainSpec;
    const testState = await import("./dump.example.json");
    const fromJson = fullStateDumpFromJson(spec);

    const parsedState = parseFromJson(testState.default, fromJson);
    const rootHash = StateEntries.serializeInMemory(spec, parsedState).getRootHash();

    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      // NOTE: [MaSo] ServiceAccountInfo changed
      strictEqual(rootHash.toString(), "0x20965842099127f43a6bf9fb3fa3bc47e479feca2759e112986427bc7cfb4a5b");
    } else {
      strictEqual(rootHash.toString(), "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a");
    }
  });
});
