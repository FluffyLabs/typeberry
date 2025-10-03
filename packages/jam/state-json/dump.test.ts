import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";
import { fullStateDumpFromJson } from "./dump.js";

describe("JSON state dump", () => {
  it("should load full JSON state dump", async () => {
    const spec = tinyChainSpec;
    const dumpFile = "./dump.example.json";
    const testState = await import(dumpFile);
    const fromJson = fullStateDumpFromJson(spec);

    const parsedState = parseFromJson(testState.default, fromJson);
    const rootHash = StateEntries.serializeInMemory(spec, parsedState).getRootHash();
    const expectedRoot = "0xf0c62b7961a17dba89a886c17dc881d7fb9e230f2cbf62316f2123a7fdbcfad5";
    strictEqual(rootHash.toString(), expectedRoot);
  });
});
