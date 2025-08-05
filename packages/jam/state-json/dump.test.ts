import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";

import { Compatibility, GpVersion } from "@typeberry/utils";
import { fullStateDumpFromJson, fullStateDumpFromJsonPre067 } from "./dump.js";

describe("JSON state dump", () => {
  it("should load full JSON state dump", async () => {
    const spec = tinyChainSpec;
    const dumpFile = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? "./dump.example.json"
      : "./dump.pre067.example.json";
    const testState = await import(dumpFile);
    const fromJson = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? fullStateDumpFromJson(spec)
      : fullStateDumpFromJsonPre067(spec);

    const parsedState = parseFromJson(testState.default, fromJson);
    const rootHash = StateEntries.serializeInMemory(spec, parsedState).getRootHash();
    const expectedRoot = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
      ? "0xa7cafbb97a7e1c6f3c1eb9a8938a90c2a9235c2628cef33e4dba8cfbcce85a37"
      : "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a";
    strictEqual(rootHash.toString(), expectedRoot);
  });
});
