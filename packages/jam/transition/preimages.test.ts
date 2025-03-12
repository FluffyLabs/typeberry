import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash, PreimagesExtrinsic } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { blake2b } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import {
  type Account,
  LookupHistoryItem,
  Preimages,
  PreimagesErrorCode,
  type PreimagesInput,
  tryAsLookupHistorySlots,
} from "./preimages";

function createInput(preimages: { requester: ServiceId; blob: BytesBlob }[], slot: number): PreimagesInput {
  return {
    preimages: preimages as PreimagesExtrinsic,
    slot: slot as TimeSlot,
  };
}

function createAccount(
  id: ServiceId,
  preimages = new HashDictionary<PreimageHash, BytesBlob>(),
  lookupHistory: LookupHistoryItem[] = [],
): Account {
  return {
    id,
    data: {
      preimages,
      lookupHistory,
    },
  };
}

describe("Preimages", () => {
  it("should reject preimages that are not sorted by requester", () => {
    const state = {
      accounts: new Map([
        [tryAsServiceId(0), createAccount(tryAsServiceId(0))],
        [tryAsServiceId(1), createAccount(tryAsServiceId(1))],
      ]),
    };
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

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.PreimagesNotSortedUnique);
  });

  it("should reject preimages that are sorted by requester but not by blob", () => {
    const state = {
      accounts: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    };
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

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.PreimagesNotSortedUnique);
  });

  it("should reject duplicates", () => {
    const state = {
      accounts: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    };
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

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.PreimagesNotSortedUnique);
  });

  it("should reject preimages when account not found", () => {
    const state = {
      accounts: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    };
    const preimages = new Preimages(state);

    const blob = BytesBlob.parseBlob("0xc0ffee0011223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput([{ requester: tryAsServiceId(1), blob }], tryAsTimeSlot(12));

    const result = preimages.integrate(input);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.AccountNotFound);
  });

  it("should reject unrequested preimages", () => {
    const state = {
      accounts: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0))]]),
    };
    const preimages = new Preimages(state);

    const blob = BytesBlob.parseBlob("0xbaddcafe11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const input = createInput([{ requester: tryAsServiceId(0), blob }], tryAsTimeSlot(12));

    const result = preimages.integrate(input);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.PreimageUnneeded);
  });

  it("should reject already integrated preimages", () => {
    const blob = BytesBlob.parseBlob("0xcafebabe11223344556677889900aabbccddeeff0123456789abcdef01234567");
    const hash = blake2b.hashBytes(blob).asOpaque();

    const preimages = new HashDictionary<PreimageHash, BytesBlob>();
    preimages.set(hash, blob);

    const lookupHistory = [
      new LookupHistoryItem(hash, tryAsU32(blob.length), tryAsLookupHistorySlots([tryAsTimeSlot(5)])),
    ];

    const state = {
      accounts: new Map([[tryAsServiceId(0), createAccount(tryAsServiceId(0), preimages, lookupHistory)]]),
    };
    const preimagesService = new Preimages(state);

    const input = createInput([{ requester: tryAsServiceId(0), blob }], tryAsTimeSlot(12));

    const result = preimagesService.integrate(input);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, PreimagesErrorCode.PreimageUnneeded);
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

    const state = {
      accounts: new Map([
        [tryAsServiceId(0), createAccount(tryAsServiceId(0), new HashDictionary(), lookupHistory)],
        [tryAsServiceId(1), createAccount(tryAsServiceId(1), new HashDictionary(), lookupHistory)],
      ]),
    };
    const preimages = new Preimages(state);

    const input = createInput(
      [
        { requester: tryAsServiceId(0), blob: blob1 },
        { requester: tryAsServiceId(1), blob: blob2 },
      ],
      tryAsTimeSlot(12),
    );

    const result = preimages.integrate(input);

    assert.strictEqual(result.isOk, true);

    const account0 = state.accounts.get(tryAsServiceId(0));
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    assert.ok(account0);
    assert.strictEqual(account0.data.preimages.has(hash1), true);
    assert.strictEqual(account0.data.preimages.get(hash1), blob1);
    assert.deepStrictEqual(account0.data.lookupHistory[0].slots, tryAsLookupHistorySlots([tryAsTimeSlot(12)]));

    const account1 = state.accounts.get(tryAsServiceId(1));
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    assert.ok(account1);
    assert.strictEqual(account1.data.preimages.has(hash2), true);
    assert.strictEqual(account1.data.preimages.get(hash2), blob2);
    assert.deepStrictEqual(account1.data.lookupHistory[1].slots, tryAsLookupHistorySlots([tryAsTimeSlot(12)]));
  });
});
