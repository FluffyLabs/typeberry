import assert from "node:assert";
import { describe, it } from "node:test";

import { type ServiceId, tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { Service, type ServiceAccountInfo } from "@typeberry/state";
import { AccountsInfoExternalities } from "./accounts-info-externalities";

describe("accounts-info-externalities", () => {
  const prepareService = (serviceId: ServiceId): Service =>
    new Service(serviceId, {
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
      storage: [],
    });

  describe("getInfo", () => {
    it("should return null when serviceId is null", async () => {
      const serviceId: ServiceId | null = null;
      const services = new Map<ServiceId, Service>();
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return null when serviceId is incorrect", async () => {
      const serviceId = tryAsServiceId(5);
      const services = new Map<ServiceId, Service>();
      const expectedServiceInfo: ServiceAccountInfo | null = null;

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });

    it("should return correct service info", async () => {
      const serviceId = tryAsServiceId(5);
      const services = new Map<ServiceId, Service>();
      const service = prepareService(serviceId);
      services.set(serviceId, service);
      const expectedServiceInfo = service.data.info;

      const accountsInfoExternalities = new AccountsInfoExternalities(services);

      const serviceInfo = await accountsInfoExternalities.getInfo(serviceId);

      assert.strictEqual(serviceInfo, expectedServiceInfo);
    });
  });
});
