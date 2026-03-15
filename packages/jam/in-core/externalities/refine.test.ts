import assert from "node:assert";
import { describe, it } from "node:test";
import { type PreimageHash, type ServiceId, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, PreimageItem, ServiceAccountInfo, type State } from "@typeberry/state";
import { RefineExternalitiesImpl, type RefineExternalitiesParams } from "./refine.js";

/**
 * Create a mock State that has specified services with preimages.
 */
function createMockState(
  services: Array<{
    id: number;
    preimages?: Array<{ hash: string; blob: string }>;
  }>,
): State {
  const serviceMap = new Map<ServiceId, InMemoryService>();
  for (const svc of services) {
    const preimages = HashDictionary.new<PreimageHash, PreimageItem>();
    for (const p of svc.preimages ?? []) {
      const hash = Bytes.parseBytes(p.hash, HASH_SIZE).asOpaque<PreimageHash>();
      const item = PreimageItem.create({
        hash,
        blob: BytesBlob.parseBlob(p.blob),
      });
      preimages.set(hash, item);
    }
    const serviceId = tryAsServiceId(svc.id);
    serviceMap.set(
      serviceId,
      new InMemoryService(serviceId, {
        info: ServiceAccountInfo.create({
          codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
          balance: tryAsU64(1_000_000_000n),
          accumulateMinGas: tryAsServiceGas(100),
          onTransferMinGas: tryAsServiceGas(100),
          storageUtilisationBytes: tryAsU64(0),
          storageUtilisationCount: tryAsU32(0),
          gratisStorage: tryAsU64(0),
          created: tryAsTimeSlot(0),
          lastAccumulation: tryAsTimeSlot(0),
          parentService: tryAsServiceId(0),
        }),
        preimages,
        lookupHistory: HashDictionary.new(),
        storage: new Map(),
      }),
    );
  }

  return {
    getService(id: ServiceId) {
      return serviceMap.get(id) ?? null;
    },
    // biome-ignore lint/suspicious/noExplicitAny: we only need getService for tests
  } as any;
}

function createExt(overrides: Partial<RefineExternalitiesParams> = {}) {
  const defaultState = createMockState([]);
  return RefineExternalitiesImpl.create({
    currentServiceId: tryAsServiceId(42),
    lookupState: overrides.lookupState ?? defaultState,
    ...overrides,
  });
}

describe("RefineExternalitiesImpl", () => {
  describe("historicalLookup", () => {
    const PREIMAGE_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const PREIMAGE_DATA = "0xdeadbeef";

    it("should return preimage data for existing service and hash", async () => {
      const lookupState = createMockState([{ id: 42, preimages: [{ hash: PREIMAGE_HASH, blob: PREIMAGE_DATA }] }]);
      const ext = createExt({ lookupState });

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const result = await ext.historicalLookup(tryAsServiceId(42), hash);

      assert.strictEqual(result?.toString(), BytesBlob.parseBlob(PREIMAGE_DATA).toString());
    });

    it("should use currentServiceId when serviceId is null", async () => {
      const lookupState = createMockState([{ id: 42, preimages: [{ hash: PREIMAGE_HASH, blob: PREIMAGE_DATA }] }]);
      const ext = createExt({ lookupState });

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const result = await ext.historicalLookup(null, hash);

      assert.notStrictEqual(result, null);
    });

    it("should return null for non-existent service", async () => {
      const lookupState = createMockState([{ id: 42 }]);
      const ext = createExt({ lookupState });

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const result = await ext.historicalLookup(tryAsServiceId(999), hash);

      assert.strictEqual(result, null);
    });

    it("should return null for non-existent preimage hash", async () => {
      const lookupState = createMockState([{ id: 42, preimages: [] }]);
      const ext = createExt({ lookupState });

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const result = await ext.historicalLookup(tryAsServiceId(42), hash);

      assert.strictEqual(result, null);
    });

    it("should look up from the correct service when multiple exist", async () => {
      const lookupState = createMockState([
        { id: 1, preimages: [{ hash: PREIMAGE_HASH, blob: "0x01" }] },
        { id: 2, preimages: [{ hash: PREIMAGE_HASH, blob: "0x02" }] },
      ]);
      const ext = createExt({ lookupState });

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const r1 = await ext.historicalLookup(tryAsServiceId(1), hash);
      const r2 = await ext.historicalLookup(tryAsServiceId(2), hash);

      assert.strictEqual(r1?.raw[0], 0x01);
      assert.strictEqual(r2?.raw[0], 0x02);
    });
  });
});
