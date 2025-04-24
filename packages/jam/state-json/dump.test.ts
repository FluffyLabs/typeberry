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

    strictEqual(rootHash.toString(), "0xc07cdbce686c64d0a9b6539c70b0bb821b6a74d9de750a46a5da05b5640c290a");
  });
});
