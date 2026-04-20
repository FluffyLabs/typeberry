import assert from "node:assert";
import { describe, it } from "node:test";

import type { CodeHash } from "@typeberry/block";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { RefineContext } from "@typeberry/block/refine-context.js";
import type { WorkItemExtrinsic } from "@typeberry/block/work-item.js";
import { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { asOpaqueType } from "@typeberry/utils";
import type { ImportedSegment, PerWorkItem } from "../../in-core/refine.js";
import { RefineFetchExternalities } from "./refine-fetch-externalities.js";

const asExtrinsic = (bytes: BytesBlob): WorkItemExtrinsic => asOpaqueType(bytes);

function buildWorkItem(overrides: {
  service?: number;
  payloadLen?: number;
  exportCount?: number;
  importCount?: number;
  extrinsicCount?: number;
}) {
  const codeHash = Bytes.fill(HASH_SIZE, 7).asOpaque<CodeHash>();
  return WorkItem.create({
    service: tryAsServiceId(overrides.service ?? 1),
    codeHash,
    payload: BytesBlob.blobFrom(new Uint8Array(overrides.payloadLen ?? 3).fill(0xab)),
    refineGasLimit: tryAsServiceGas(1_000_000),
    accumulateGasLimit: tryAsServiceGas(2_000_000),
    importSegments: asKnownSize(new Array(overrides.importCount ?? 0)),
    extrinsic: new Array(overrides.extrinsicCount ?? 0),
    exportCount: tryAsU16(overrides.exportCount ?? 0),
  });
}

function buildWorkPackage(items: WorkItem[]) {
  return WorkPackage.create({
    authToken: BytesBlob.blobFrom(new Uint8Array([1, 2, 3])),
    authCodeHost: tryAsServiceId(42),
    authCodeHash: Bytes.fill(HASH_SIZE, 9).asOpaque<CodeHash>(),
    authConfiguration: BytesBlob.blobFrom(new Uint8Array([4, 5, 6, 7])),
    context: RefineContext.create({
      anchor: Bytes.fill(HASH_SIZE, 1).asOpaque(),
      stateRoot: Bytes.fill(HASH_SIZE, 2).asOpaque(),
      beefyRoot: Bytes.fill(HASH_SIZE, 3).asOpaque(),
      lookupAnchor: Bytes.fill(HASH_SIZE, 4).asOpaque(),
      lookupAnchorSlot: tryAsTimeSlot(16),
      prerequisites: [],
    }),
    items: FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
  });
}

function prepareRefineData(
  opts: {
    chainSpec?: ChainSpec;
    items?: WorkItem[];
    currentWorkItemIndex?: number;
    extrinsics?: PerWorkItem<WorkItemExtrinsic[]>;
    imports?: PerWorkItem<ImportedSegment[]>;
    authorizerTrace?: BytesBlob;
  } = {},
) {
  const chainSpec = opts.chainSpec ?? tinyChainSpec;
  const items = opts.items ?? [buildWorkItem({})];
  const workPackage = buildWorkPackage(items);
  return new RefineFetchExternalities(chainSpec, {
    workPackage,
    currentWorkItemIndex: opts.currentWorkItemIndex ?? 0,
    imports: opts.imports ?? asKnownSize(items.map(() => [])),
    extrinsics: opts.extrinsics ?? asKnownSize(items.map(() => [])),
    authorizerTrace: opts.authorizerTrace ?? BytesBlob.empty(),
  });
}

describe("RefineFetchExternalities", () => {
  it("should return different constants for different chain specs", () => {
    const tinyExt = prepareRefineData({ chainSpec: tinyChainSpec });
    const fullExt = prepareRefineData({ chainSpec: fullChainSpec });

    assert.notStrictEqual(tinyExt.constants().length, 0);
    assert.notStrictEqual(fullExt.constants().length, 0);
    assert.notDeepStrictEqual(tinyExt.constants(), fullExt.constants());
  });

  it("should return entropy H_0 (zero hash) per GP §B.3", () => {
    const ext = prepareRefineData();
    const entropy = ext.entropy();
    assert.strictEqual(entropy.length, HASH_SIZE);
    assert.ok(entropy.isEqualTo(Bytes.zero(HASH_SIZE).asOpaque()));
  });

  it("should return the supplied authorizer trace", () => {
    const trace = BytesBlob.blobFrom(new Uint8Array([0xaa, 0xbb, 0xcc]));
    const ext = prepareRefineData({ authorizerTrace: trace });
    assert.deepStrictEqual(ext.authorizerTrace().raw, trace.raw);
  });

  it("should return an extrinsic by work item index and extrinsic index", () => {
    const items = [buildWorkItem({}), buildWorkItem({ service: 2 })];
    const extrinsics: PerWorkItem<WorkItemExtrinsic[]> = asKnownSize([
      [asExtrinsic(BytesBlob.blobFrom(new Uint8Array([1])))],
      [
        asExtrinsic(BytesBlob.blobFrom(new Uint8Array([2, 2]))),
        asExtrinsic(BytesBlob.blobFrom(new Uint8Array([3, 3, 3]))),
      ],
    ]);
    const ext = prepareRefineData({ items, extrinsics });

    const other = ext.workItemExtrinsic(tryAsU64(1), tryAsU64(1));
    assert.ok(other !== null);
    assert.deepStrictEqual(other.raw, new Uint8Array([3, 3, 3]));
  });

  it("should return current item's extrinsic when workItem is null", () => {
    const items = [buildWorkItem({}), buildWorkItem({ service: 2 })];
    const extrinsics: PerWorkItem<WorkItemExtrinsic[]> = asKnownSize([
      [asExtrinsic(BytesBlob.blobFrom(new Uint8Array([9])))],
      [asExtrinsic(BytesBlob.blobFrom(new Uint8Array([8])))],
    ]);
    const ext = prepareRefineData({ items, extrinsics, currentWorkItemIndex: 1 });

    const mine = ext.workItemExtrinsic(null, tryAsU64(0));
    assert.ok(mine !== null);
    assert.deepStrictEqual(mine.raw, new Uint8Array([8]));
  });

  it("should return null for out-of-range extrinsic indices", () => {
    const items = [buildWorkItem({})];
    const extrinsics: PerWorkItem<WorkItemExtrinsic[]> = asKnownSize([
      [asExtrinsic(BytesBlob.blobFrom(new Uint8Array([1])))],
    ]);
    const ext = prepareRefineData({ items, extrinsics });

    assert.strictEqual(ext.workItemExtrinsic(tryAsU64(5), tryAsU64(0)), null);
    assert.strictEqual(ext.workItemExtrinsic(tryAsU64(0), tryAsU64(5)), null);
    assert.strictEqual(ext.workItemExtrinsic(null, tryAsU64(5)), null);
  });

  it("should treat U64 indices above the safe-integer range as out of range", () => {
    const items = [buildWorkItem({})];
    const ext = prepareRefineData({ items });
    const huge = tryAsU64(2n ** 53n); // first value > Number.MAX_SAFE_INTEGER
    assert.strictEqual(ext.workItemExtrinsic(huge, tryAsU64(0)), null);
    assert.strictEqual(ext.workItemExtrinsic(null, huge), null);
    assert.strictEqual(ext.workItemImport(huge, tryAsU64(0)), null);
    assert.strictEqual(ext.oneWorkItem(huge), null);
    assert.strictEqual(ext.workItemPayload(huge), null);
  });

  it("should return an import segment by work item index and segment index", () => {
    const items = [buildWorkItem({}), buildWorkItem({ service: 2 })];
    const segBytes = new Uint8Array(16).fill(0x55);
    const imports: PerWorkItem<ImportedSegment[]> = asKnownSize([
      [],
      [{ index: 0 as never, data: Bytes.fromBlob(segBytes, 16) as never }],
    ]);
    const ext = prepareRefineData({ items, imports });

    const imp = ext.workItemImport(tryAsU64(1), tryAsU64(0));
    assert.ok(imp !== null);
    assert.deepStrictEqual(imp.raw, segBytes);
  });

  it("should return null for out-of-range import indices", () => {
    const ext = prepareRefineData();
    assert.strictEqual(ext.workItemImport(tryAsU64(10), tryAsU64(0)), null);
    assert.strictEqual(ext.workItemImport(null, tryAsU64(10)), null);
  });

  it("should return encoded work package", () => {
    const items = [buildWorkItem({})];
    const ext = prepareRefineData({ items });
    const expected = Encoder.encodeObject(WorkPackage.Codec, buildWorkPackage(items), tinyChainSpec);
    assert.deepStrictEqual(ext.workPackage().raw, expected.raw);
  });

  it("should return auth configuration and auth token from the package", () => {
    const ext = prepareRefineData();
    assert.deepStrictEqual(ext.authConfiguration().raw, new Uint8Array([4, 5, 6, 7]));
    assert.deepStrictEqual(ext.authToken().raw, new Uint8Array([1, 2, 3]));
  });

  it("should return encoded refine context", () => {
    const ext = prepareRefineData();
    const context = RefineContext.create({
      anchor: Bytes.fill(HASH_SIZE, 1).asOpaque(),
      stateRoot: Bytes.fill(HASH_SIZE, 2).asOpaque(),
      beefyRoot: Bytes.fill(HASH_SIZE, 3).asOpaque(),
      lookupAnchor: Bytes.fill(HASH_SIZE, 4).asOpaque(),
      lookupAnchorSlot: tryAsTimeSlot(16),
      prerequisites: [],
    });
    const expected = Encoder.encodeObject(RefineContext.Codec, context);
    assert.deepStrictEqual(ext.refineContext().raw, expected.raw);
  });

  it("should return concatenated work item summaries (kind 11) with 62 bytes per item", () => {
    const items = [
      buildWorkItem({ service: 1, payloadLen: 7, exportCount: 2, importCount: 1, extrinsicCount: 0 }),
      buildWorkItem({ service: 2, payloadLen: 4, exportCount: 0, importCount: 0, extrinsicCount: 3 }),
    ];
    const ext = prepareRefineData({ items });
    const all = ext.allWorkItems();
    assert.strictEqual(all.length, 62 * items.length);
  });

  it("should return a single work item summary (kind 12)", () => {
    const items = [buildWorkItem({ service: 1 }), buildWorkItem({ service: 2, payloadLen: 10 })];
    const ext = prepareRefineData({ items });

    const one = ext.oneWorkItem(tryAsU64(1));
    assert.ok(one !== null);
    assert.strictEqual(one.length, 62);

    // first 4 bytes are the service id (u32 LE).
    const serviceId = new DataView(one.raw.buffer, one.raw.byteOffset, 4).getUint32(0, true);
    assert.strictEqual(serviceId, 2);
    // payload length is the last 4 bytes (u32 LE).
    const payloadLen = new DataView(one.raw.buffer, one.raw.byteOffset + 58, 4).getUint32(0, true);
    assert.strictEqual(payloadLen, 10);
  });

  it("should return null for one work item when index is out of range", () => {
    const ext = prepareRefineData();
    assert.strictEqual(ext.oneWorkItem(tryAsU64(99)), null);
  });

  it("should return the raw payload of a work item (kind 13)", () => {
    const items = [buildWorkItem({ service: 1, payloadLen: 2 }), buildWorkItem({ service: 2, payloadLen: 5 })];
    const ext = prepareRefineData({ items });
    const payload = ext.workItemPayload(tryAsU64(1));
    assert.ok(payload !== null);
    assert.strictEqual(payload.length, 5);
    assert.ok(payload.raw.every((x) => x === 0xab));
  });

  it("should return null for payload when index is out of range", () => {
    const ext = prepareRefineData();
    assert.strictEqual(ext.workItemPayload(tryAsU64(99)), null);
  });

  // guard against silent accidental changes to the helpers — tryAsU32 ensures
  // encoded lengths match GP's S(w) spec.
  it("uses unsigned little-endian u32 for payload length regardless of platform", () => {
    const items = [buildWorkItem({ service: 1, payloadLen: 0x1234 })];
    const ext = prepareRefineData({ items });
    const one = ext.oneWorkItem(tryAsU64(0));
    assert.ok(one !== null);
    const payloadLen = new DataView(one.raw.buffer, one.raw.byteOffset + 58, 4).getUint32(0, true);
    assert.strictEqual(payloadLen, 0x1234);
    // tryAsU32 would throw on negative values
    assert.doesNotThrow(() => tryAsU32(0x1234));
  });
});
