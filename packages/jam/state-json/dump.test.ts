import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";

import { fullStateDumpFromJson } from "./dump";

describe("JSON state dump", () => {
  it("should load full JSON state dump", () => {
    const spec = tinyChainSpec;
    const testState = require("./dump.example.json");
    const fromJson = fullStateDumpFromJson(spec);

    const parsedState = parseFromJson(testState, fromJson);
    const rootHash = merkelizeState(serializeState(parsedState, spec));

    // TODO [ToDr] This needs an update after 0.6.4 merge due to statisitcs.
    strictEqual(rootHash.toString(), "0xd1490d9b667a5907737546ba36e0b9fe6ae000269b87683dba2017205fcda01a");
  });
});
