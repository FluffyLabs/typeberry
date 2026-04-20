import assert from "node:assert";
import { describe, it } from "node:test";

import type { CodeHash } from "@typeberry/block";
import { tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU64 } from "@typeberry/numbers";
import { IsAuthorizedFetchExternalities } from "./is-authorized-fetch-externalities.js";

function buildWorkItem(overrides: { service?: number; payloadLen?: number } = {}) {
  return WorkItem.create({
    service: tryAsServiceId(overrides.service ?? 1),
    codeHash: Bytes.fill(HASH_SIZE, 7).asOpaque<CodeHash>(),
    payload: BytesBlob.blobFrom(new Uint8Array(overrides.payloadLen ?? 3).fill(0xab)),
    refineGasLimit: tryAsServiceGas(1_000_000),
    accumulateGasLimit: tryAsServiceGas(2_000_000),
    importSegments: asKnownSize([]),
    extrinsic: [],
    exportCount: tryAsU16(0),
  });
}

function buildPackage(items: WorkItem[] = [buildWorkItem({})]) {
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

describe("IsAuthorizedFetchExternalities", () => {
  it("returns different constants for different chain specs", () => {
    const tinyExt = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage());
    const fullExt = new IsAuthorizedFetchExternalities(fullChainSpec, buildPackage());
    assert.notStrictEqual(tinyExt.constants().length, 0);
    assert.notDeepStrictEqual(tinyExt.constants(), fullExt.constants());
  });

  it("returns encoded work package", () => {
    const pkg = buildPackage();
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, pkg);
    const expected = Encoder.encodeObject(WorkPackage.Codec, pkg, tinyChainSpec);
    assert.deepStrictEqual(ext.workPackage().raw, expected.raw);
  });

  it("returns auth configuration and auth token from the package", () => {
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage());
    assert.deepStrictEqual(ext.authConfiguration().raw, new Uint8Array([4, 5, 6, 7]));
    assert.deepStrictEqual(ext.authToken().raw, new Uint8Array([1, 2, 3]));
  });

  it("returns encoded refine context", () => {
    const pkg = buildPackage();
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, pkg);
    const expected = Encoder.encodeObject(RefineContext.Codec, pkg.context);
    assert.deepStrictEqual(ext.refineContext().raw, expected.raw);
  });

  it("returns concatenated work item summaries with 62 bytes per item", () => {
    const items = [buildWorkItem({ service: 1 }), buildWorkItem({ service: 2, payloadLen: 5 })];
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage(items));
    assert.strictEqual(ext.allWorkItems().length, 62 * items.length);
  });

  it("returns a single work item summary (kind 12)", () => {
    const items = [buildWorkItem({ service: 1 }), buildWorkItem({ service: 2, payloadLen: 10 })];
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage(items));
    const one = ext.oneWorkItem(tryAsU64(1));
    assert.ok(one !== null);
    assert.strictEqual(one.length, 62);
    const serviceId = new DataView(one.raw.buffer, one.raw.byteOffset, 4).getUint32(0, true);
    assert.strictEqual(serviceId, 2);
  });

  it("returns null for one work item when index is out of range", () => {
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage());
    assert.strictEqual(ext.oneWorkItem(tryAsU64(99)), null);
  });

  it("returns the raw payload of a work item (kind 13)", () => {
    const items = [buildWorkItem({ service: 1, payloadLen: 2 }), buildWorkItem({ service: 2, payloadLen: 5 })];
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage(items));
    const payload = ext.workItemPayload(tryAsU64(1));
    assert.ok(payload !== null);
    assert.strictEqual(payload.length, 5);
    assert.ok(payload.raw.every((x) => x === 0xab));
  });

  it("returns null for payload when index is out of range", () => {
    const ext = new IsAuthorizedFetchExternalities(tinyChainSpec, buildPackage());
    assert.strictEqual(ext.workItemPayload(tryAsU64(99)), null);
  });
});
