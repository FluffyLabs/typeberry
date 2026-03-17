import assert from "node:assert";
import { describe, it } from "node:test";
import {
  MAX_NUMBER_OF_EXPORTS_WP,
  type PreimageHash,
  SEGMENT_BYTES,
  type Segment,
  type ServiceId,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { SegmentExportError } from "@typeberry/jam-host-calls";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, InMemoryState, PreimageItem, ServiceAccountInfo, type State } from "@typeberry/state";
import { RefineExternalitiesImpl, type RefineExternalitiesParams } from "./refine.js";

function createSegment(byte = 0xab): Segment {
  return Bytes.fill(byte, SEGMENT_BYTES);
}

function createSmallSegment(bytes: number[]): Segment {
  const data = new Uint8Array(SEGMENT_BYTES);
  data.set(bytes);
  return Bytes.fromBlob(data, SEGMENT_BYTES);
}

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

  return InMemoryState.partial(tinyChainSpec, { services: serviceMap });
}

function createExt(overrides: Partial<RefineExternalitiesParams> = {}) {
  const defaultState = createMockState([]);
  return RefineExternalitiesImpl.create({
    currentServiceId: tryAsServiceId(42),
    lookupState: overrides.lookupState ?? defaultState,
    exportOffset: overrides.exportOffset ?? 0,
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
      const ext = createExt();

      const hash = Bytes.parseBytes(PREIMAGE_HASH, HASH_SIZE).asOpaque();
      const result = await ext.historicalLookup(tryAsServiceId(999), hash);

      assert.strictEqual(result, null);
    });

    it("should return null for non-existent preimage hash", async () => {
      const lookupState = createMockState([{ id: 42 }]);
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

  describe("exportSegment", () => {
    it("should export a segment and return its index", () => {
      const ext = createExt();
      const segment = createSegment(0x01);
      const result = ext.exportSegment(segment);

      assert.strictEqual(result.isOk, true);
      assert.strictEqual(result.ok, 0); // first export at offset 0
      assert.strictEqual(ext.getExportedSegments().length, 1);
    });

    it("should return sequential indices for multiple exports", () => {
      const ext = createExt();

      const r1 = ext.exportSegment(createSegment(0x01));
      const r2 = ext.exportSegment(createSegment(0x02));
      const r3 = ext.exportSegment(createSegment(0x03));

      assert.strictEqual(r1.isOk, true);
      assert.strictEqual(r1.ok, 0);
      assert.strictEqual(r2.isOk, true);
      assert.strictEqual(r2.ok, 1);
      assert.strictEqual(r3.isOk, true);
      assert.strictEqual(r3.ok, 2);
      assert.strictEqual(ext.getExportedSegments().length, 3);
    });

    it("should apply exportOffset to segment indices", () => {
      const ext = createExt({ exportOffset: 100 });
      const result = ext.exportSegment(createSegment());

      assert.strictEqual(result.isOk, true);
      assert.strictEqual(result.ok, 100);
    });

    it("should return SegmentExportError when MAX_NUMBER_OF_EXPORTS_WP exceeded", () => {
      const ext = createExt({ exportOffset: MAX_NUMBER_OF_EXPORTS_WP });
      const result = ext.exportSegment(createSegment());

      assert.strictEqual(result.isError, true);
      assert.strictEqual(result.error, SegmentExportError);
    });

    it("should return SegmentExportError at exactly MAX_NUMBER_OF_EXPORTS_WP - 1 + 1", () => {
      const ext = createExt({ exportOffset: MAX_NUMBER_OF_EXPORTS_WP - 1 });

      // This one should succeed (index = MAX_NUMBER_OF_EXPORTS_WP - 1)
      const r1 = ext.exportSegment(createSegment(0x01));
      assert.strictEqual(r1.isOk, true);
      assert.strictEqual(r1.ok, MAX_NUMBER_OF_EXPORTS_WP - 1);

      // This one should fail
      const r2 = ext.exportSegment(createSegment(0x02));
      assert.strictEqual(r2.isError, true);
      assert.strictEqual(r2.error, SegmentExportError);
    });

    it("should store exact segment data", () => {
      const ext = createExt();
      const segment = createSmallSegment([1, 2, 3, 4, 5]);
      ext.exportSegment(segment);

      const exported = ext.getExportedSegments();
      assert.strictEqual(exported.length, 1);
      assert.deepStrictEqual(exported[0].raw.subarray(0, 5), new Uint8Array([1, 2, 3, 4, 5]));
    });
  });
});
