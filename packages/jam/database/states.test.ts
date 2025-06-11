import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { TEST_STATE_ROOT, testState } from "@typeberry/state/test.utils.js";
import { deepEqual } from "@typeberry/utils";
import { InMemoryStates } from "./states.js";

describe("InMemoryState", () => {
  it("should write and read some state", async () => {
    const db = new InMemoryStates(tinyChainSpec);
    const root = Bytes.parseBytes(TEST_STATE_ROOT, HASH_SIZE).asOpaque();
    deepEqual(db.getFullState(root), null);

    await db.insertFullState(root, testState());

    deepEqual(db.getFullState(root), testState());
  });
});
