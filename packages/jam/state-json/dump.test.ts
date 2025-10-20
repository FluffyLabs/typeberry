import { strictEqual } from "node:assert";
import { before, describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { parseFromJson } from "@typeberry/json-parser";
import { StateEntries } from "@typeberry/state-merkleization";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { fullStateDumpFromJson } from "./dump.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("JSON state dump", () => {
  it("should load full JSON state dump", async () => {
    const spec = tinyChainSpec;
    const dumpFile = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
      ? "./dump-071.example.json"
      : "./dump.example.json";
    const testState = await import(dumpFile);
    const fromJson = fullStateDumpFromJson(spec);

    const parsedState = parseFromJson(testState.default, fromJson);

    const rootHash = StateEntries.serializeInMemory(spec, blake2b, parsedState).getRootHash(blake2b);

    const expectedRoot = Compatibility.selectIfGreaterOrEqual({
      fallback: "0xf0c62b7961a17dba89a886c17dc881d7fb9e230f2cbf62316f2123a7fdbcfad5",
      versions: {
        [GpVersion.V0_7_1]: "0xeab8f2d4aebacd4ddcb73d8b5a388e5723aff1d2bc3f4aab40e931addf1862dc",
      },
    });
    strictEqual(rootHash.toString(), expectedRoot);
  });
});
