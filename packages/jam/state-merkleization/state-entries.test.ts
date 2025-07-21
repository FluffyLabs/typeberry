import assert, { deepEqual } from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { tryAsPerCore } from "@typeberry/state/common.js";
import { TEST_STATE, TEST_STATE_ROOT, testState } from "@typeberry/state/test.utils.js";
import { serializeStateUpdate } from "./serialize-state-update.js";
import { SerializedState } from "./serialized-state.js";
import { StateEntries } from "./state-entries.js";
import { Compatibility, GpVersion } from "@typeberry/utils";

const spec = tinyChainSpec;

describe("State Serialization", () => {
  it("should load and serialize the test state", () => {
    const state = testState();
    const serialized = StateEntries.serializeInMemory(spec, state);
    for (const [actualKey, actualValue] of serialized.entries.data) {
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

    const expectedRoot = Compatibility.isGreaterOrEqual(GpVersion.V0_6_5)
      ? "0x22e5ebfb233c49d833af107ae8933ab229bceb49db1d2604abb2e120bc381eba"
      : "0xd30fa98d70ae1f039b8ac40a0fd9f4478f7b57e0faac396a51e4df3718c985b2";

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
