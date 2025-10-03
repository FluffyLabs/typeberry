import { before, describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  ServiceAccountInfo,
  tryAsLookupHistorySlots,
  UpdateService,
} from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { SerializedState } from "./serialized-state.js";
import { StateEntries } from "./state-entries.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

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
            gratisStorage: tryAsU64(1024),
            created: tryAsTimeSlot(8),
            lastAccumulation: tryAsTimeSlot(12),
            parentService: tryAsServiceId(10),
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
    const serializedState = StateEntries.serializeInMemory(tinyChainSpec, blake2b, initialState);
    return {
      initialState,
      serializedState,
    };
  };

  it("should load serialized state", () => {
    const { initialState, serializedState } = testInitialState();
    // load the state from a dictionary.
    const state = SerializedState.fromStateEntries(tinyChainSpec, blake2b, serializedState);

    // copy back to memory from it's serialized form
    const copiedState = InMemoryState.copyFrom(
      state,
      new Map([
        [
          tryAsServiceId(10),
          {
            storageKeys: [],
            preimages: [],
            lookupHistory: [{ hash: Bytes.fill(HASH_SIZE, 5).asOpaque(), length: tryAsU32(10_000) }],
          },
        ],
      ]),
    );

    deepEqual(copiedState, initialState);
  });
});
