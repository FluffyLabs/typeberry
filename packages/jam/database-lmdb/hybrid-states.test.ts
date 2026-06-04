// packages/jam/database-lmdb/hybrid-states.test.ts
import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import type { HeaderHash } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { InMemoryState } from "@typeberry/state";
import { StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { deepEqual, OK, Result } from "@typeberry/utils";
import { HybridSerializedStates } from "./hybrid-states.js";

let blake2b: Blake2b;
before(async () => {
  blake2b = await Blake2b.createHasher();
});

function createTempDir(suffix = "hybrid"): string {
  return fs.mkdtempSync(`typeberry-${suffix}`);
}

describe("Hybrid serialized states", () => {
  const spec = tinyChainSpec;
  const headerHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();
  let dbPath = "";

  beforeEach(() => {
    dbPath = createTempDir();
  });
  afterEach(() => {
    fs.rmSync(dbPath, { recursive: true });
  });

  it("round-trips an initial state through the on-disk values store", async () => {
    const states = HybridSerializedStates.new({
      spec,
      blake2b,
      dbPath,
    });
    try {
      const empty = InMemoryState.empty(spec);
      const serialized = StateEntries.serializeInMemory(spec, blake2b, empty);
      const expectedRoot = serialized.getRootHash(blake2b);

      const res = await states.insertInitialState(headerHash, serialized);
      deepEqual(res, Result.ok(OK));

      const state = states.getState(headerHash);
      assert.ok(state !== null);
      const stateRoot = await states.getStateRoot(state);
      assert.strictEqual(`${stateRoot}`, `${expectedRoot}`);
      deepEqual(InMemoryState.copyFrom(spec, state, new Map()), empty);
    } finally {
      await states.close();
    }
  });

  it("reads large values back from disk", async () => {
    const states = HybridSerializedStates.new({ spec, blake2b, dbPath });
    try {
      // > 32 bytes => stored in the values db (not embedded in the leaf).
      const big1 = BytesBlob.blobFromString("x".repeat(100));
      const big2 = BytesBlob.blobFromString("y".repeat(100));
      const key1: StateKey = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const key2: StateKey = Bytes.fill(HASH_SIZE, 2).asOpaque();
      const entries = StateEntries.fromEntriesUnsafe([
        [key1, big1],
        [key2, big2],
      ]);

      const res = await states.insertInitialState(headerHash, entries);
      deepEqual(res, Result.ok(OK));

      const state = states.getState(headerHash);
      assert.ok(state !== null);
      assert.strictEqual(`${state.backend.get(key2)}`, `${big2}`);
      assert.strictEqual(`${state.backend.get(key1)}`, `${big1}`);
    } finally {
      await states.close();
    }
  });

  it("drops the leaf set on markUnused while values stay on disk", async () => {
    const states = HybridSerializedStates.new({ spec, blake2b, dbPath });
    try {
      const empty = InMemoryState.empty(spec);
      const serialized = StateEntries.serializeInMemory(spec, blake2b, empty);
      await states.insertInitialState(headerHash, serialized);
      assert.ok(states.getState(headerHash) !== null);

      states.markUnused(headerHash);
      assert.strictEqual(states.getState(headerHash), null);
    } finally {
      await states.close();
    }
  });
});
