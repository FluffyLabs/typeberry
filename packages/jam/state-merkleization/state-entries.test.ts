import assert, { deepEqual } from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { TEST_STATE, TEST_STATE_ROOT, testState } from "@typeberry/state/test.utils.js";
import { StateEntries } from "./state-entries.js";

const spec = tinyChainSpec;

describe("State Serialization", () => {
  it("should load and serialize the test state", () => {
    const state = testState();
    const serialized = StateEntries.serializeInMemory(spec, state);
    for (const [actualKey, actualValue] of serialized.entries) {
      let foundKey = false;
      for (const [expectedKey, expectedValue, details] of TEST_STATE) {
        if (actualKey.isEqualTo(Bytes.parseBytes(expectedKey, HASH_SIZE))) {
          deepEqual(actualValue.toString(), expectedValue, `Error while in test state at ${actualKey}: ${details}`);
          foundKey = true;
          break;
        }
      }
      if (!foundKey) {
        throw new Error(`Unexpected key: ${actualKey} not found in the test state!`);
      }
    }
  });
});

describe("State Merkleization", () => {
  it("should load and merkelize the test state", () => {
    const state = testState();
    const serialized = StateEntries.serializeInMemory(spec, state);
    const stateRoot = serialized.getRootHash();

    assert.strictEqual(stateRoot.toString(), TEST_STATE_ROOT);
  });
});
