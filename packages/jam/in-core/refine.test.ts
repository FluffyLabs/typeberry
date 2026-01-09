import assert from "node:assert";
import { before, describe, it } from "node:test";
import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray } from "@typeberry/collections";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/config";
import { InMemoryStates } from "@typeberry/database";
import { Blake2b, HASH_SIZE, WithHash } from "@typeberry/hash";
import { tryAsU16 } from "@typeberry/numbers";
import { testState } from "@typeberry/state/test.utils.js";
import { Refine, RefineError } from "./refine.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function createWorkItem(serviceId = 1) {
  return WorkItem.create({
    service: tryAsServiceId(serviceId),
    codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
    payload: BytesBlob.empty(),
    refineGasLimit: tryAsServiceGas(1_000_000),
    accumulateGasLimit: tryAsServiceGas(1_000_000),
    importSegments: asKnownSize([]),
    extrinsic: [],
    exportCount: tryAsU16(0),
  });
}

function createWorkPackage(anchorHash: HeaderHash, stateRoot: StateRootHash, lookupAnchorSlot = 0) {
  return WorkPackage.create({
    authorization: BytesBlob.empty(),
    authCodeHost: tryAsServiceId(1),
    authCodeHash: Bytes.zero(HASH_SIZE).asOpaque(),
    parametrization: BytesBlob.empty(),
    context: RefineContext.create({
      anchor: anchorHash,
      stateRoot,
      beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      lookupAnchor: anchorHash,
      lookupAnchorSlot: tryAsTimeSlot(lookupAnchorSlot),
      prerequisites: [],
    }),
    items: FixedSizeArray.new([createWorkItem()], tryAsWorkItemsCount(1)),
  });
}

function hashWorkPackage(spec: ChainSpec, workPackage: WorkPackage): WithHash<WorkPackageHash, WorkPackage> {
  const workPackageHash = blake2b
    .hashBytes(Encoder.encodeObject(WorkPackage.Codec, workPackage, spec))
    .asOpaque<WorkPackageHash>();
  return new WithHash(workPackageHash, workPackage);
}

describe("Refine", () => {
  it("should return StateMissing error when anchor block state is not in DB", async () => {
    const spec = tinyChainSpec;
    const states = new InMemoryStates(spec);
    const refine = new Refine(spec, states, PvmBackend.BuiltIn, blake2b);

    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
    const stateRoot = Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>();
    const workPackage = createWorkPackage(anchorHash, stateRoot);

    const result = await refine.refine(
      hashWorkPackage(spec, workPackage),
      tryAsCoreIndex(0),
      asKnownSize([[]]),
      asKnownSize([[]]),
    );

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, RefineError.StateMissing);
  });

  it("should refine work package and produce a report when state is set up", async () => {
    const spec = tinyChainSpec;
    const states = new InMemoryStates(spec);
    const refine = new Refine(spec, states, PvmBackend.BuiltIn, blake2b);

    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
    const state = testState();
    await states.insertInitialState(anchorHash, state);

    const correctStateRoot = await states.getStateRoot(state);
    const workPackage = createWorkPackage(anchorHash, correctStateRoot, state.timeslot);

    const result = await refine.refine(
      hashWorkPackage(spec, workPackage),
      tryAsCoreIndex(0),
      asKnownSize([[]]),
      asKnownSize([[]]),
    );

    assert.strictEqual(result.isOk, true);
    assert.strictEqual(result.ok.report.coreIndex, 0);
    assert.strictEqual(result.ok.report.results.length, 1);
  });
});
