import { describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  ServiceAccountInfo,
  UpdateService,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { TriePersistence, merkelizeState } from "./merkleize";
import { convertInMemoryStateToDictionary } from "./serialize-inmemory";
import { SerializedState } from "./state-serialized";

describe("SerializedState", () => {
  const testInitialState = () => {
    const initialState = InMemoryState.empty(tinyChainSpec);
    // add one service
    initialState.applyUpdate({
      servicesUpdates: [
        UpdateService.create({
          serviceId: tryAsServiceId(10),
          serviceInfo: ServiceAccountInfo.create({
            codeHash: Bytes.fill(HASH_SIZE, 1).asOpaque(),
            balance: tryAsU64(10_000_000n),
            accumulateMinGas: tryAsServiceGas(100),
            onTransferMinGas: tryAsServiceGas(10),
            storageUtilisationBytes: tryAsU64(10),
            storageUtilisationCount: tryAsU32(3),
          }),
          lookupHistory: new LookupHistoryItem(
            Bytes.fill(HASH_SIZE, 5).asOpaque(),
            tryAsU32(10_000),
            tryAsLookupHistorySlots([]),
          ),
        }),
      ],
    });
    // serialize into a dictionary
    const serializedState = convertInMemoryStateToDictionary(initialState, tinyChainSpec);
    return {
      initialState,
      serializedState,
    };
  };

  it("should load serialized state", () => {
    const { initialState, serializedState } = testInitialState();
    // load the state from a dictionary.
    const state = new SerializedState(tinyChainSpec, serializedState);

    // copy back to memory from it's serialized form
    const copiedState = InMemoryState.copyFrom(
      state,
      new Map([
        [
          tryAsServiceId(10),
          {
            storageKeys: [],
            preimages: [],
            lookupHistory: [[Bytes.fill(HASH_SIZE, 5).asOpaque(), tryAsU32(10_000)]],
          },
        ],
      ]),
    );

    deepEqual(copiedState, initialState);
  });

  it("should calculate merkle root", () => {
    const { serializedState } = testInitialState();
    const expectedMerkleRoot = merkelizeState(serializedState);

    // load the state from a dictionary.
    const db = TriePersistence.fromStateDictionary(serializedState);
    const _state = new SerializedState(tinyChainSpec, db);
    // and calculate it's merkle root
    const actualMerkleRoot = db.getRootHash();
    // TODO [ToDr] alter the state

    deepEqual(actualMerkleRoot, expectedMerkleRoot);
  });
});
