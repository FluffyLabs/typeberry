import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { type HeaderHash, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { SortedSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  PrivilegedServices,
  ServiceAccountInfo,
  tryAsLookupHistorySlots,
  tryAsPerCore,
  UpdateService,
} from "@typeberry/state";
import { testState } from "@typeberry/state/test.utils.js";
import { StateEntries } from "@typeberry/state-merkleization";
import { InMemoryTrie, leafComparator } from "@typeberry/trie";
import { getBlake2bTrieHasher } from "@typeberry/trie/hasher.js";
import type { TrieHasher } from "@typeberry/trie/nodesDb.js";
import { deepEqual, OK, Result } from "@typeberry/utils";
import { LmdbRoot } from "./root.js";
import { LmdbStates } from "./states.js";

let blake2bTrieHasher: TrieHasher;
let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
  blake2bTrieHasher = getBlake2bTrieHasher(blake2b);
});

function createTempDir(suffix = "lmdb"): string {
  return fs.mkdtempSync(`typeberry-${suffix}`);
}

describe("LMDB States database", () => {
  let tmpDir = "";
  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, {
      recursive: true,
    });
  });

  const headerHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();
  const spec = tinyChainSpec;

  it("should import state and read state", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, blake2b, root);

    const emptyState = InMemoryState.empty(spec);
    const serialized = StateEntries.serializeInMemory(spec, blake2b, emptyState);
    const emptyRoot = serialized.getRootHash(blake2b);

    // when
    const res = await states.insertState(headerHash, serialized);
    deepEqual(res, Result.ok(OK));
    const newState = states.getState(headerHash);
    assert.ok(newState !== null);
    const newRoot = await states.getStateRoot(newState);

    assert.deepStrictEqual(`${newRoot}`, `${emptyRoot}`);
    deepEqual(InMemoryState.copyFrom(newState, new Map()), emptyState);
  });

  it("should update the state", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, blake2b, root);
    const state = InMemoryState.empty(spec);
    await states.insertState(headerHash, StateEntries.serializeInMemory(spec, blake2b, state));
    const newState = states.getState(headerHash);
    assert.ok(newState !== null);
    const headerHash2: HeaderHash = Bytes.fill(HASH_SIZE, 2).asOpaque();

    const lookupHistory = new LookupHistoryItem(
      Bytes.fill(HASH_SIZE, 0xff).asOpaque(),
      tryAsU32(5),
      tryAsLookupHistorySlots([]),
    );
    const stateUpdate = {
      timeslot: tryAsTimeSlot(15),
      privilegedServices: PrivilegedServices.create({
        manager: tryAsServiceId(1),
        authManager: tryAsPerCore(new Array(spec.coresCount).fill(tryAsServiceId(2)), spec),
        validatorsManager: tryAsServiceId(3),
        autoAccumulateServices: [],
      }),
      servicesUpdates: new Map([
        [
          tryAsServiceId(1),
          UpdateService.create({
            serviceInfo: ServiceAccountInfo.create({
              codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
              balance: tryAsU64(1_000_000),
              accumulateMinGas: tryAsServiceGas(10_000),
              onTransferMinGas: tryAsServiceGas(5_000),
              storageUtilisationBytes: tryAsU64(1_000),
              gratisStorage: tryAsU64(0),
              storageUtilisationCount: tryAsU32(1),
              created: tryAsTimeSlot(0),
              lastAccumulation: tryAsTimeSlot(0),
              parentService: tryAsServiceId(0),
            }),
            lookupHistory,
          }),
        ],
      ]),
    };

    // when
    // in-memory state update
    const res1 = state.applyUpdate(stateUpdate);
    deepEqual(res1, Result.ok(OK));
    // on-disk state update
    const res2 = await states.updateAndSetState(headerHash2, newState, stateUpdate);
    deepEqual(res2, Result.ok(OK));

    const updatedState = states.getState(headerHash2);
    assert.ok(updatedState !== null);
    const updatedStateRoot = await states.getStateRoot(updatedState);

    deepEqual(
      InMemoryState.copyFrom(
        updatedState,
        new Map([
          [
            tryAsServiceId(1),
            {
              storageKeys: [],
              preimages: [],
              lookupHistory: [{ hash: lookupHistory.hash, length: lookupHistory.length }],
            },
          ],
        ]),
      ),
      state,
    );
    assert.strictEqual(
      `${updatedStateRoot}`,
      `${StateEntries.serializeInMemory(spec, blake2b, state).getRootHash(blake2b)}`,
    );
  });

  it("sorted set should be actual to trie", () => {
    const data: [OpaqueHash, BytesBlob][] = [
      [Bytes.fill(HASH_SIZE, 5), BytesBlob.blobFromString("five")],
      [Bytes.fill(HASH_SIZE, 1), BytesBlob.blobFromString("one")],
      [Bytes.fill(HASH_SIZE, 3), BytesBlob.blobFromString("three")],
      [Bytes.fill(HASH_SIZE, 4), BytesBlob.blobFromString("four")],
      [Bytes.fill(HASH_SIZE, 2), BytesBlob.blobFromString("two")],
    ];

    const trie = InMemoryTrie.empty(blake2bTrieHasher);
    for (const [key, val] of data) {
      trie.set(key.asOpaque(), val);
    }

    const set = SortedSet.fromArray(
      leafComparator,
      data.map(([key, value]) => {
        return InMemoryTrie.constructLeaf(blake2bTrieHasher, key.asOpaque(), value);
      }),
    );

    deepEqual(Array.from(set), Array.from(SortedSet.fromArray(leafComparator, Array.from(trie.nodes.leaves()))));
  });

  it("should import more complex state", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, blake2b, root);

    const initialState = testState();
    const initialService = initialState.services.get(tryAsServiceId(0));
    if (initialService === undefined) {
      throw new Error("Expected service in test state!");
    }

    const serialized = StateEntries.serializeInMemory(spec, blake2b, initialState);
    const initialRoot = serialized.getRootHash(blake2b);

    // when
    const res = await states.insertState(headerHash, serialized);
    deepEqual(res, Result.ok(OK));
    const newState = states.getState(headerHash);
    assert.ok(newState !== null);
    const newRoot = await states.getStateRoot(newState);

    assert.deepStrictEqual(`${newRoot}`, `${initialRoot}`);
    deepEqual(
      InMemoryState.copyFrom(newState, new Map([[initialService.serviceId, initialService.getEntries()]])),
      initialState,
    );
  });

  it("should update more complex entries", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, blake2b, root);
    const state = testState();
    const initialService = state.services.get(tryAsServiceId(0));
    if (initialService === undefined) {
      throw new Error("Expected service in test state!");
    }
    await states.insertState(headerHash, StateEntries.serializeInMemory(spec, blake2b, state));
    const newState = states.getState(headerHash);
    assert.ok(newState !== null);
    const headerHash2: HeaderHash = Bytes.fill(HASH_SIZE, 2).asOpaque();

    // attempt to update all entries
    const stateUpdate = Object.assign({}, state);

    // when
    // in-memory state update
    const res1 = state.applyUpdate(stateUpdate);
    deepEqual(res1, Result.ok(OK));
    // on-disk state update
    const res2 = await states.updateAndSetState(headerHash2, newState, stateUpdate);
    deepEqual(res2, Result.ok(OK));

    const updatedState = states.getState(headerHash2);
    assert.ok(updatedState !== null);
    const updatedStateRoot = await states.getStateRoot(updatedState);

    deepEqual(
      InMemoryState.copyFrom(updatedState, new Map([[initialService.serviceId, initialService.getEntries()]])),
      state,
    );
    assert.strictEqual(
      `${updatedStateRoot}`,
      `${StateEntries.serializeInMemory(spec, blake2b, state).getRootHash(blake2b)}`,
    );
  });
});
