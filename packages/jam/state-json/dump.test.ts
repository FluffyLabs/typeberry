import { strictEqual } from "node:assert";
import { before, describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";
import { fullStateDumpFromJson } from "./dump.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("JSON state dump", () => {
  it("should load full JSON state dump", async () => {
    const spec = tinyChainSpec;
    const dumpFile = "./dump.example.json";
    const testState = await import(dumpFile);
    const fromJson = fullStateDumpFromJson(spec);

    const parsedState = parseFromJson(testState.default, fromJson);

    const rootHash = StateEntries.serializeInMemory(spec, blake2b, parsedState).getRootHash(blake2b);

    const expectedRoot = "0xeab8f2d4aebacd4ddcb73d8b5a388e5723aff1d2bc3f4aab40e931addf1862dc";
    strictEqual(rootHash.toString(), expectedRoot);
  });
});
