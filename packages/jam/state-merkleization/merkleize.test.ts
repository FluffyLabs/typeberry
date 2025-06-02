import assert from "node:assert";
import { describe, it } from "node:test";
import { tinyChainSpec } from "@typeberry/config";
import { TEST_STATE_ROOT, testState } from "@typeberry/state/test.utils";
import { merkelizeState, serializeInMemoryState } from ".";

const spec = tinyChainSpec;

describe("State Merkleization", () => {
  it("should load and merkelize the test state", () => {
    const state = testState();
    const serialized = serializeInMemoryState(state, spec);
    const stateRoot = merkelizeState(serialized);

    assert.strictEqual(stateRoot.toString(), TEST_STATE_ROOT);
  });
});
