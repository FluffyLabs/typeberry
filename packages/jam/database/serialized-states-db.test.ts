import assert from "node:assert";
import { before, describe, it } from "node:test";
import { type HeaderHash, tryAsServiceId } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { type ServicesUpdate, type State, StorageItem, type StorageKey, UpdateStorage } from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils.js";
import { type SerializedState, StateEntries } from "@typeberry/state-merkleization";
import { asOpaqueType, deepEqual, OK, Result } from "@typeberry/utils";
import type { LeafDb } from "./leaf-db.js";
import { InMemorySerializedStates } from "./serialized-states-db.js";

let blake2b: Blake2b;
before(async () => {
  blake2b = await Blake2b.createHasher();
});

const spec = tinyChainSpec;

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

async function newStates() {
  const states = InMemorySerializedStates.withHasher({ chainSpec: spec, blake2b });
  const res = await states.insertInitialState(hh(0), StateEntries.serializeInMemory(spec, blake2b, testState()));
  deepEqual(res, Result.ok(OK));
  return states;
}

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

describe("InMemorySerializedStates value refcounting", () => {
  it("keeps a replaced value until the block replacing it finalizes", async () => {
    const states = await newStates();
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
    assert.ok(!canReadFully(stale1), "replaced value is dropped once the replacement finalizes");
    assert.ok(canReadFully(states.getState(hh(2))), "the new finalized tip stays fully readable");
  });

  it("collects values of a pruned dead fork and keeps the surviving chain intact", async () => {
    const states = await newStates();
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
    assert.ok(!canReadFully(staleFork), "fork-only value is collected");
    assert.ok(canReadFully(states.getState(hh(1))), "surviving chain is unaffected");
  });

  it("does not collect a value shared with a pruned fork", async () => {
    const states = await newStates();
    const s0 = states.getState(hh(0));
    assert.ok(s0 !== null);
    await states.updateAndSetState(hh(1), s0, storageUpdate(BIG_1));
    // the fork writes the very same value
    const fork = states.getState(hh(0));
    assert.ok(fork !== null);
    await states.updateAndSetState(hh(0xaa), fork, storageUpdate(BIG_1));

    states.markUnused(hh(0xaa));

    assert.ok(canReadFully(states.getState(hh(1))), "value still referenced by the surviving chain");
  });

  it("follows the importer lifecycle: commit finalized, then prune", async () => {
    const states = await newStates();
    const s0 = states.getState(hh(0));
    assert.ok(s0 !== null);
    await states.updateAndSetState(hh(1), s0, storageUpdate(BIG_1));
    const s1 = states.getState(hh(1));
    assert.ok(s1 !== null);
    await states.updateAndSetState(hh(2), s1, storageUpdate(BIG_2));

    // finality round: 1 and 2 finalized, genesis and 1 pruned
    states.commitFinalized([hh(1), hh(2)]);
    states.markUnused(hh(0));
    states.markUnused(hh(1));

    assert.strictEqual(states.getState(hh(1)), null);
    assert.ok(canReadFully(states.getState(hh(2))), "finalized tip fully readable after pruning");
  });
});
