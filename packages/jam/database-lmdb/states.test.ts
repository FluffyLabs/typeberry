import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { type HeaderHash, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  PrivilegedServices,
  ServiceAccountInfo,
  UpdateService,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { StateEntries } from "@typeberry/state-merkleization";
import { testState } from "@typeberry/state/test.utils";
import { OK, Result, deepEqual } from "@typeberry/utils";
import { LmdbRoot } from "./root";
import { LmdbStates } from "./states";

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
    const states = new LmdbStates(spec, root);

    const emptyState = InMemoryState.empty(spec);
    const serialized = StateEntries.serializeInMemory(spec, emptyState);
    const emptyRoot = serialized.getRootHash();

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
    const states = new LmdbStates(spec, root);
    const state = InMemoryState.empty(spec);
    await states.insertState(headerHash, StateEntries.serializeInMemory(spec, state));
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
        authManager: tryAsServiceId(2),
        validatorsManager: tryAsServiceId(3),
        autoAccumulateServices: [],
      }),
      servicesUpdates: [
        UpdateService.create({
          serviceId: tryAsServiceId(1),
          serviceInfo: ServiceAccountInfo.create({
            codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
            balance: tryAsU64(1_000_000),
            accumulateMinGas: tryAsServiceGas(10_000),
            onTransferMinGas: tryAsServiceGas(5_000),
            storageUtilisationBytes: tryAsU64(1_000),
            storageUtilisationCount: tryAsU32(1),
          }),
          lookupHistory,
        }),
      ],
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
    assert.strictEqual(`${updatedStateRoot}`, `${StateEntries.serializeInMemory(spec, state).getRootHash()}`);
  });

  it("should import more complex state", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, root);

    const initialState = testState();
    const serialized = StateEntries.serializeInMemory(spec, initialState);
    const initialRoot = serialized.getRootHash();

    // when
    const res = await states.insertState(headerHash, serialized);
    deepEqual(res, Result.ok(OK));
    const newState = states.getState(headerHash);
    assert.ok(newState !== null);
    const newRoot = await states.getStateRoot(newState);

    assert.deepStrictEqual(`${newRoot}`, `${initialRoot}`);
    deepEqual(InMemoryState.copyFrom(newState, new Map()), initialState);
  });

  it("should update more complex entries", async () => {
    const root = new LmdbRoot(tmpDir);
    const states = new LmdbStates(spec, root);
    const state = testState();
    await states.insertState(headerHash, StateEntries.serializeInMemory(spec, state));
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

    deepEqual(InMemoryState.copyFrom(updatedState, new Map()), state);
    assert.strictEqual(`${updatedStateRoot}`, `${StateEntries.serializeInMemory(spec, state).getRootHash()}`);
  });
});
