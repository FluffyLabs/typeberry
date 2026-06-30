import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import type { LeafDb } from "@typeberry/database";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import {
  InMemoryState,
  type ServicesUpdate,
  type State,
  StorageItem,
  type StorageKey,
  UpdateStorage,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils.js";
import { type SerializedState, StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { asOpaqueType, deepEqual, OK, Result } from "@typeberry/utils";
import { FjallValuesSession, HybridSerializedStates } from "./hybrid-states.js";

let blake2b: Blake2b;
before(async () => {
  blake2b = await Blake2b.createHasher();
});

function createTempDir(suffix = "fjall-hybrid"): string {
  return fs.mkdtempSync(`typeberry-${suffix}`);
}

describe("Fjall hybrid serialized states", () => {
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
    const states = await HybridSerializedStates.new({ spec, blake2b, dbPath });
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
    const states = await HybridSerializedStates.new({ spec, blake2b, dbPath });
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

  it("shares an open values session across resets without closing it", async () => {
    // The fuzz reset path opens the values keyspace once per session and reuses
    // it: each "reset" builds a fresh states instance sharing that session, and
    // closing a session-backed states must NOT close the shared keyspace.
    const session = await FjallValuesSession.open(dbPath);
    try {
      const big = BytesBlob.blobFromString("z".repeat(100));
      const key: StateKey = Bytes.fill(HASH_SIZE, 7).asOpaque();
      const entries = StateEntries.fromEntriesUnsafe([[key, big]]);

      // First "reset": write values through a states instance, then close it.
      const first = HybridSerializedStates.fromSession(spec, blake2b, session);
      const res = await first.insertInitialState(headerHash, entries);
      deepEqual(res, Result.ok(OK));
      await first.close();

      // Second "reset": a fresh states sharing the same session. Its in-memory
      // leaf set is independent (empty until it inserts)...
      const second = HybridSerializedStates.fromSession(spec, blake2b, session);
      assert.strictEqual(second.getState(headerHash), null);

      // ...but the on-disk values store is the same one, still open and usable
      // (a closed keyspace would throw here).
      await second.insertInitialState(headerHash, entries);
      const state = second.getState(headerHash);
      assert.ok(state !== null);
      assert.strictEqual(`${state.backend.get(key)}`, `${big}`);
      await second.close();
    } finally {
      await session.close();
    }
  });

  it("drops the leaf set on markUnused while values stay on disk", async () => {
    const states = await HybridSerializedStates.new({ spec, blake2b, dbPath });
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

function hh(n: number): HeaderHash {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

const storageKey: StorageKey = asOpaqueType(BytesBlob.blobFromString("test-key"));

/** A state update writing a single large (non-embedded) value under `storageKey`. */
function storageUpdate(value: string): Partial<State & ServicesUpdate> {
  const item = StorageItem.create({ key: storageKey, value: BytesBlob.blobFromString(value) });
  return {
    storage: new Map([[tryAsServiceId(0), [UpdateStorage.set({ storage: item })]]]),
  };
}

// > 32 bytes => stored in the values db (not embedded in the leaf).
const BIG_1 = "a".repeat(100);
const BIG_2 = "b".repeat(100);

/** `true` if every value referenced by the state can still be resolved. */
function canReadFully(state: SerializedState<LeafDb> | null): boolean {
  if (state === null) {
    return false;
  }
  try {
    state.backend.intoStateEntries();
    return true;
  } catch {
    return false;
  }
}

/** Value removals are queued, so poll for the expected outcome. */
async function eventually(check: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) {
      assert.fail(`Timed out waiting for: ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("Fjall hybrid serialized states value refcounting", () => {
  const spec = tinyChainSpec;
  let dbPath = "";

  beforeEach(() => {
    dbPath = createTempDir();
  });
  afterEach(() => {
    fs.rmSync(dbPath, { recursive: true });
  });

  it("removes a replaced value from disk once the replacement finalizes", async () => {
    const states = await HybridSerializedStates.new({ spec, blake2b, dbPath });
    try {
      await states.insertInitialState(hh(0), StateEntries.serializeInMemory(spec, blake2b, testState()));
      const s0 = states.getState(hh(0));
      assert.ok(s0 !== null);
      await states.updateAndSetState(hh(1), s0, storageUpdate(BIG_1));
      // a handle to the post-1 state, surviving the pruning below
      const stale1 = states.getState(hh(1));
      const s1 = states.getState(hh(1));
      assert.ok(s1 !== null);
      await states.updateAndSetState(hh(2), s1, storageUpdate(BIG_2));

      states.commitFinalized([hh(1)]);
      assert.ok(canReadFully(stale1), "still referenced by the finalized tip");

      states.commitFinalized([hh(2)]);
      await eventually(() => !canReadFully(stale1), "replaced value removed from fjall");
      assert.ok(canReadFully(states.getState(hh(2))), "the new finalized tip stays fully readable");
    } finally {
      await states.close();
    }
  });

  it("collects values of a pruned dead fork and keeps the surviving chain intact", async () => {
    const states = await HybridSerializedStates.new({ spec, blake2b, dbPath });
    try {
      await states.insertInitialState(hh(0), StateEntries.serializeInMemory(spec, blake2b, testState()));
      const s0 = states.getState(hh(0));
      assert.ok(s0 !== null);
      await states.updateAndSetState(hh(1), s0, storageUpdate(BIG_1));
      // a dead fork on top of genesis, inserting a different value
      const fork = states.getState(hh(0));
      assert.ok(fork !== null);
      await states.updateAndSetState(hh(0xaa), fork, storageUpdate(BIG_2));
      const staleFork = states.getState(hh(0xaa));

      states.markUnused(hh(0xaa));

      assert.strictEqual(states.getState(hh(0xaa)), null);
      await eventually(() => !canReadFully(staleFork), "fork-only value removed from fjall");
      assert.ok(canReadFully(states.getState(hh(1))), "surviving chain is unaffected");
    } finally {
      await states.close();
    }
  });
});
