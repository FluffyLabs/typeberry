import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, InMemoryState, type ServiceAccountInfo } from "@typeberry/state";
import { AccountsInfoExternalities } from "./accounts-info-externalities.js";

describe("accounts-info-externalities", () => {
  const prepareService = (serviceId: ServiceId): InMemoryService =>
    new InMemoryService(serviceId, {
      info: {
        accumulateMinGas: tryAsServiceGas(serviceId),
        balance: tryAsU64(serviceId),
        codeHash: Bytes.fill(HASH_SIZE, serviceId).asOpaque(),
        onTransferMinGas: tryAsServiceGas(serviceId),
        storageUtilisationBytes: tryAsU64(serviceId),
        storageUtilisationCount: tryAsU32(serviceId),
      },
      lookupHistory: HashDictionary.new(),
      preimages: HashDictionary.new(),
      storage: HashDictionary.new(),
    });

  describe("getInfo", () => {
    it("should return null when serviceId is null", async () => {
      const serviceId: ServiceId | null = null;
      const services = InMemoryState.empty(tinyChainSpec);
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return null when serviceId is incorrect", async () => {
      const serviceId = tryAsServiceId(5);
      const services = InMemoryState.empty(tinyChainSpec);
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return correct service info", async () => {
      const serviceId = tryAsServiceId(5);
      const service = prepareService(serviceId);
      const services = InMemoryState.partial(tinyChainSpec, {
        services: new Map([[serviceId, service]]),
      });
      const expectedServiceInfo = service.getInfo();

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });
  });
});
