import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, PreimageItem, ServiceAccountInfo } from "@typeberry/state";
import { AccountsLookupExternalities } from "./accounts-lookup-externalities.js";

describe("accounts-lookup-externalities", () => {
  describe("lookup", () => {
    const prepareState = (correctServiceId: ServiceId, preimageHash = Bytes.zero(HASH_SIZE).asOpaque()) => ({
      getService: (serviceId: ServiceId) => {
        if (serviceId === correctServiceId) {
          const preimages = HashDictionary.new<PreimageHash, PreimageItem>();

          preimages.set(
            preimageHash,
            PreimageItem.create({
              hash: preimageHash,
              blob: BytesBlob.empty(),
            }),
          );

          return new InMemoryService(serviceId, {
            info: ServiceAccountInfo.create({
              balance: tryAsU64(2 ** 32),
              accumulateMinGas: tryAsServiceGas(1000),
              storageUtilisationBytes: tryAsU64(0),
              storageUtilisationCount: tryAsU32(0),
              codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
              onTransferMinGas: tryAsServiceGas(1000),
            }),
            storage: HashDictionary.new(),
            preimages,
            lookupHistory: HashDictionary.new(),
          });
        }

        return null;
      },
    });

    it("should return null when serviceId is null", async () => {
      const serviceId: ServiceId | null = null;
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState(tryAsServiceId(0));
      const expectedResult: BytesBlob | null = null;

      const accountsLookupExternalities = new AccountsLookupExternalities(state);

      const result = await accountsLookupExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when service does not exist", async () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState(tryAsServiceId(2));
      const expectedResult: BytesBlob | null = null;

      const accountsLookupExternalities = new AccountsLookupExternalities(state);

      const result = await accountsLookupExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return null when preimage does not exists", async () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState(serviceId, Bytes.fill(HASH_SIZE, 2).asOpaque());
      const expectedResult: BytesBlob | null = null;

      const accountsLookupExternalities = new AccountsLookupExternalities(state);

      const result = await accountsLookupExternalities.lookup(serviceId, hash);

      assert.strictEqual(result, expectedResult);
    });

    it("should return return a correct preimage", async () => {
      const serviceId = tryAsServiceId(0);
      const hash = Bytes.fill(HASH_SIZE, 1);
      const state = prepareState(serviceId, hash.asOpaque());
      const expectedResult = BytesBlob.empty();

      const accountsLookupExternalities = new AccountsLookupExternalities(state);

      const result = await accountsLookupExternalities.lookup(serviceId, hash);

      assert.deepStrictEqual(result, expectedResult);
    });
  });
});
