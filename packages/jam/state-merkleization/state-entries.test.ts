import assert, { deepEqual } from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE, TRUNCATED_HASH_SIZE } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { tryAsPerCore } from "@typeberry/state/common.js";
import { TEST_STATE, TEST_STATE_ROOT, testState } from "@typeberry/state/test.utils.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { serializeStateUpdate } from "./serialize-state-update.js";
import { SerializedState } from "./serialized-state.js";
import { StateEntries } from "./state-entries.js";

const spec = tinyChainSpec;

describe("State Serialization", () => {
  it("should load and serialize the test state", () => {
    const state = testState();
    const serialized = StateEntries.serializeInMemory(spec, state);
    for (const [actualKey, actualValue] of serialized) {
      let foundKey = false;
      for (const [expectedKey, expectedValue, details] of TEST_STATE) {
        if (actualKey.isEqualTo(Bytes.parseBytes(expectedKey.substring(0, 64), TRUNCATED_HASH_SIZE))) {
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

  it("should update the state", () => {
    const serialized = StateEntries.serializeInMemory(spec, testState());
    assert.strictEqual(serialized.getRootHash().toString(), TEST_STATE_ROOT);

    const authPools: State["authPools"] = tryAsPerCore(
      [asKnownSize([Bytes.fill(HASH_SIZE, 12).asOpaque()]), asKnownSize([Bytes.fill(HASH_SIZE, 15).asOpaque()])],
      spec,
    );
    const update = serializeStateUpdate(spec, { authPools });

    // when
    serialized.applyUpdate(update);

    // check the value
    const state = SerializedState.fromStateEntries(spec, serialized);
    assert.deepStrictEqual(state.authPools, authPools);

    let expectedRoot: string;
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)) {
      expectedRoot = "0xcf33ddfb0987283f7614652d7eb4d3509e5efd93466a4b28ab4865cc912a66e1";
    } else if (Compatibility.is(GpVersion.V0_6_7)) {
      expectedRoot = "0xa6354341d3c232456ec5cdd4fd84daf474d7083ebc4de180363e656c6e62a704";
    } else {
      expectedRoot = "0xb075c9dacc6df40a4ac189b6573e9a0d35f2744a759b1ce0d51a272bab3bea5f";
    }

    assert.strictEqual(serialized.getRootHash().toString(), expectedRoot);
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
