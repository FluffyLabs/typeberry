import assert from "node:assert";
import { describe, it } from "node:test";
import type { ServiceId } from "@typeberry/block";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryService,
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { Result } from "@typeberry/utils";
import { Preimages, PreimagesErrorCode, type PreimagesInput } from "./preimages.js";

function createInput(preimages: { requester: ServiceId; blob: BytesBlob }[], slot: number): PreimagesInput {
  return {
    preimages: preimages as PreimagesExtrinsic,
    slot: tryAsTimeSlot(slot),
  };
}

function createAccount(
  id: ServiceId,
  preimagesEntries: PreimageItem[] = [],
  lookupHistoryEntries: LookupHistoryItem[] = [],
): InMemoryService {
  const preimages = HashDictionary.fromEntries(preimagesEntries.map((x) => [x.hash, x]));
  const lookupHistory = HashDictionary.fromEntries(lookupHistoryEntries.map((x) => [x.hash, [x]]));

  return new InMemoryService(id, {
    info: ServiceAccountInfo.create({
      version: tryAsU64(0),
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(0),
      accumulateMinGas: tryAsServiceGas(0),
      onTransferMinGas: tryAsServiceGas(0),
      storageUtilisationBytes: tryAsU64(0),
      storageUtilisationCount: tryAsU32(0),
      gratisStorage: tryAsU64(0),
      created: tryAsTimeSlot(0),
      lastAccumulation: tryAsTimeSlot(0),
      parentService: tryAsServiceId(0),
    }),
    storage: new Map(),
    preimages,
    lookupHistory,
  });
}

describe("Preimages", () => {
  it("should reject preimages that are not sorted by requester", () => {
    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([
        [tryAsServiceId(0), createAccount(tryAsServiceId(0))],
        [tryAsServiceId(1), createAccount(tryAsServiceId(1))],
      ]),
    });
    const preimages = new Preimages(state);

    const blob1 = BytesBlob.parseBlob("0xd34db33f11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const blob2 = BytesBlob.parseBlob("0xf00dc0de11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput(
      [
        { requester: tryAsServiceId(1), blob: blob1 },
        { requester: tryAsServiceId(0), blob: blob2 },
      ],
      tryAsTimeSlot(12),
    );

    const result = preimages.integrate(input);

    assert.deepStrictEqual(result, {
      isError: true,
      isOk: false,
      error: PreimagesErrorCode.PreimagesNotSortedUnique,
      details: "",
    });
  });

  it("should reject preimages that are sorted by requester but not by blob", () => {
    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    });
    const preimages = new Preimages(state);

    const blob1 = BytesBlob.parseBlob("0xf00dc0de11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const blob2 = BytesBlob.parseBlob("0xd34db33f11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput(
      [
        { requester: tryAsServiceId(0), blob: blob1 },
        { requester: tryAsServiceId(0), blob: blob2 },
      ],
      tryAsTimeSlot(12),
    );

    const result = preimages.integrate(input);

    assert.deepStrictEqual(result, {
      isError: true,
      isOk: false,
      error: PreimagesErrorCode.PreimagesNotSortedUnique,
      details: "",
    });
  });

  it("should reject duplicates", () => {
    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    });
    const preimages = new Preimages(state);

    const blob = BytesBlob.parseBlob("0xdeadbeef11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput(
      [
        { requester: tryAsServiceId(0), blob },
        { requester: tryAsServiceId(0), blob },
      ],
      tryAsTimeSlot(12),
    );

    const result = preimages.integrate(input);

    assert.deepStrictEqual(result, {
      isError: true,
      isOk: false,
      error: PreimagesErrorCode.PreimagesNotSortedUnique,
      details: "",
    });
  });

  it("should reject preimages when account not found", () => {
    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    });
    const preimages = new Preimages(state);

    const blob = BytesBlob.parseBlob("0xc0ffee0011223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput([{ requester: tryAsServiceId(1), blob }], tryAsTimeSlot(12));

    const result = preimages.integrate(input);

    assert.deepStrictEqual(result, Result.error(PreimagesErrorCode.AccountNotFound));
  });

  it("should reject unrequested preimages", () => {
    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    });
    const preimages = new Preimages(state);

    const blob = BytesBlob.parseBlob("0xbaddcafe11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput([{ requester: tryAsServiceId(0), blob }], tryAsTimeSlot(12));

    const result = preimages.integrate(input);

    assert.deepStrictEqual(result, {
      isError: true,
      isOk: false,
      error: PreimagesErrorCode.PreimageUnneeded,
      details: "",
    });
  });

  it("should reject already integrated preimages", () => {
    const blob = BytesBlob.parseBlob("0xcafebabe11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const hash = blake2b.hashBytes(blob).asOpaque();

    const preimages = [PreimageItem.create({ hash, blob })];
    const lookupHistory = [
      new LookupHistoryItem(hash, tryAsU32(blob.length), tryAsLookupHistorySlots([tryAsTimeSlot(5)])),
    ];

    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0), preimages, lookupHistory)]]),
    });
    const preimagesService = new Preimages(state);

    const input = createInput([{ requester: tryAsServiceId(0), blob }], tryAsTimeSlot(12));

    const result = preimagesService.integrate(input);

    assert.deepStrictEqual(result, {
      isError: true,
      isOk: false,
      error: PreimagesErrorCode.PreimageUnneeded,
      details: "",
    });
  });

  it("should successfully integrate preimages", () => {
    const blob1 = BytesBlob.parseBlob("0x1337beef11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const blob2 = BytesBlob.parseBlob("0x8badf00d11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const hash1 = blake2b.hashBytes(blob1).asOpaque();
    const hash2 = blake2b.hashBytes(blob2).asOpaque();

    const lookupHistory = [
      new LookupHistoryItem(hash1, tryAsU32(blob1.length), tryAsLookupHistorySlots([])),
      new LookupHistoryItem(hash2, tryAsU32(blob2.length), tryAsLookupHistorySlots([])),
    ];

    const state = InMemoryState.partial(tinyChainSpec, {
      services: new Map([
        [tryAsServiceId(0), createAccount(tryAsServiceId(0), [], lookupHistory)],
        [tryAsServiceId(1), createAccount(tryAsServiceId(1), [], lookupHistory)],
      ]),
    });
    const preimages = new Preimages(state);

    const input = createInput(
      [
        { requester: tryAsServiceId(0), blob: blob1 },
        { requester: tryAsServiceId(1), blob: blob2 },
      ],
      tryAsTimeSlot(12),
    );

    const result = preimages.integrate(input);
    assert.deepStrictEqual(result.isOk, true);
    state.applyUpdate(result.ok);

    const account0 = state.services.get(tryAsServiceId(0));
    assert.ok(account0 !== undefined);
    const account0LookupHistory = Array.from(account0.data.lookupHistory.values());
    assert.strictEqual(account0.data.preimages.has(hash1), true);
    assert.strictEqual(account0.data.preimages.get(hash1)?.blob, blob1);
    assert.deepStrictEqual(account0LookupHistory[0][0].slots, tryAsLookupHistorySlots([tryAsTimeSlot(12)]));
    assert.deepStrictEqual(account0LookupHistory[1][0].slots, tryAsLookupHistorySlots([]));

    const account1 = state.services.get(tryAsServiceId(1));
    assert.ok(account1 !== undefined);
    const account1LookupHistory = Array.from(account1.data.lookupHistory.values());
    assert.strictEqual(account1.data.preimages.has(hash2), true);
    assert.strictEqual(account1.data.preimages.get(hash2)?.blob, blob2);
    assert.deepStrictEqual(account1LookupHistory[0][0].slots, tryAsLookupHistorySlots([]));
    assert.deepStrictEqual(account1LookupHistory[1][0].slots, tryAsLookupHistorySlots([tryAsTimeSlot(12)]));
  });
});
