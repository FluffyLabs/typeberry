import assert from "node:assert";
import * as fs from "node:fs";
import { afterEach, before, beforeEach, describe, it } from "node:test";
import { type HeaderHash, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
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
import { StateEntries, type StateKey } from "@typeberry/state-merkleization";
import { deepEqual, OK, Result } from "@typeberry/utils";
import { FjallRoot } from "./root.js";
import { FjallStates } from "./states.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("Fjall states database", () => {
  const headerHash: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();
  const spec = tinyChainSpec;
  let tmpDir = "";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync("typeberry-fjall-states-");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("imports and reads an empty state", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const states = await FjallStates.open(spec, blake2b, root);
    try {
      const emptyState = InMemoryState.empty(spec);
      const serialized = StateEntries.serializeInMemory(spec, blake2b, emptyState);
      const emptyRoot = serialized.getRootHash(blake2b);

      deepEqual(await states.insertInitialState(headerHash, serialized), Result.ok(OK));
      const newState = states.getState(headerHash);
      assert.ok(newState !== null);

      assert.strictEqual(`${await states.getStateRoot(newState)}`, `${emptyRoot}`);
      deepEqual(InMemoryState.copyFrom(spec, newState, new Map()), emptyState);
    } finally {
      await states.close();
      await root.close();
    }
  });

  it("reads large values back from disk", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const states = await FjallStates.open(spec, blake2b, root);
    try {
      const big1 = BytesBlob.blobFromString("x".repeat(100));
      const big2 = BytesBlob.blobFromString("y".repeat(100));
      const key1: StateKey = Bytes.fill(HASH_SIZE, 1).asOpaque();
      const key2: StateKey = Bytes.fill(HASH_SIZE, 2).asOpaque();
      const entries = StateEntries.fromEntriesUnsafe([
        [key1, big1],
        [key2, big2],
      ]);

      deepEqual(await states.insertInitialState(headerHash, entries), Result.ok(OK));
      const state = states.getState(headerHash);
      assert.ok(state !== null);
      assert.strictEqual(`${state.backend.get(key2)}`, `${big2}`);
      assert.strictEqual(`${state.backend.get(key1)}`, `${big1}`);
    } finally {
      await states.close();
      await root.close();
    }
  });

  it("updates state", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const states = await FjallStates.open(spec, blake2b, root);
    try {
      const state = InMemoryState.empty(spec);
      await states.insertInitialState(headerHash, StateEntries.serializeInMemory(spec, blake2b, state));
      const newState = states.getState(headerHash);
      assert.ok(newState !== null);
      const headerHash2: HeaderHash = Bytes.fill(HASH_SIZE, 2).asOpaque();

      const lookupHistory = LookupHistoryItem.new(
        Bytes.fill(HASH_SIZE, 0xff).asOpaque(),
        tryAsU32(5),
        tryAsLookupHistorySlots([]),
      );
      const stateUpdate = {
        timeslot: tryAsTimeSlot(15),
        privilegedServices: PrivilegedServices.create({
          manager: tryAsServiceId(1),
          assigners: tryAsPerCore(new Array(spec.coresCount).fill(tryAsServiceId(2)), spec),
          delegator: tryAsServiceId(3),
          registrar: tryAsServiceId(4),
          autoAccumulateServices: new Map(),
        }),
        updated: new Map([
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

      deepEqual(state.applyUpdate(stateUpdate), Result.ok(OK));
      deepEqual(await states.updateAndSetState(headerHash2, newState, stateUpdate), Result.ok(OK));

      const updatedState = states.getState(headerHash2);
      assert.ok(updatedState !== null);
      deepEqual(
        InMemoryState.copyFrom(
          spec,
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
        `${await states.getStateRoot(updatedState)}`,
        `${StateEntries.serializeInMemory(spec, blake2b, state).getRootHash(blake2b)}`,
      );
    } finally {
      await states.close();
      await root.close();
    }
  });

  it("imports a more complex state", async () => {
    const root = await FjallRoot.open(tmpDir, { ephemeral: true });
    const states = await FjallStates.open(spec, blake2b, root);
    try {
      const initialState = testState();
      const initialService = initialState.services.get(tryAsServiceId(0));
      assert.ok(initialService !== undefined);

      const serialized = StateEntries.serializeInMemory(spec, blake2b, initialState);
      deepEqual(await states.insertInitialState(headerHash, serialized), Result.ok(OK));

      const newState = states.getState(headerHash);
      assert.ok(newState !== null);
      assert.strictEqual(`${await states.getStateRoot(newState)}`, `${serialized.getRootHash(blake2b)}`);
      deepEqual(
        InMemoryState.copyFrom(spec, newState, new Map([[initialService.serviceId, initialService.getEntries()]])),
        initialState,
      );
    } finally {
      await states.close();
      await root.close();
    }
  });
});
