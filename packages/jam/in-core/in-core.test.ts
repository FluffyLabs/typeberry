import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import type { CodeHash, HeaderHash, StateRootHash } from "@typeberry/block";
import { tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { WorkPackageHash } from "@typeberry/block/refine-context.js";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import { asKnownSize, FixedSizeArray, HashDictionary } from "@typeberry/collections";
import { type ChainSpec, PvmBackend, tinyChainSpec } from "@typeberry/config";
import { InMemoryStates } from "@typeberry/database";
import { Blake2b, HASH_SIZE, type OpaqueHash, WithHash } from "@typeberry/hash";
import { tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, InMemoryState, PreimageItem, ServiceAccountInfo } from "@typeberry/state";
import { InCore, RefineError } from "./in-core.js";

// Load the authorizer PVM fixture (checks authToken === authConfiguration).
const AUTHORIZER_PVM = BytesBlob.blobFrom(readFileSync(resolve(import.meta.dirname, "fixtures/authorizer.pvm")));
const AUTH_SERVICE_ID = tryAsServiceId(1);

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function getAuthCodeHash() {
  return blake2b.hashBytes(AUTHORIZER_PVM).asOpaque<CodeHash>();
}

function createService(serviceId: typeof AUTH_SERVICE_ID, codeHash: OpaqueHash, code: BytesBlob): InMemoryService {
  return new InMemoryService(serviceId, {
    info: ServiceAccountInfo.create({
      codeHash: codeHash.asOpaque<CodeHash>(),
      balance: tryAsU64(10_000_000_000),
      accumulateMinGas: tryAsServiceGas(0n),
      onTransferMinGas: tryAsServiceGas(0n),
      storageUtilisationBytes: tryAsU64(0),
      storageUtilisationCount: tryAsU32(0),
      gratisStorage: tryAsU64(0),
      created: tryAsTimeSlot(0),
      lastAccumulation: tryAsTimeSlot(0),
      parentService: tryAsServiceId(0),
    }),
    preimages: HashDictionary.fromEntries(
      [PreimageItem.create({ hash: codeHash.asOpaque(), blob: code })].map((x) => [x.hash, x]),
    ),
    lookupHistory: HashDictionary.fromEntries([]),
    storage: new Map(),
  });
}

function createWorkItem(codeHash: CodeHash, serviceId = 1) {
  return WorkItem.create({
    service: tryAsServiceId(serviceId),
    codeHash,
    payload: BytesBlob.empty(),
    refineGasLimit: tryAsServiceGas(1_000_000),
    accumulateGasLimit: tryAsServiceGas(1_000_000),
    importSegments: asKnownSize([]),
    extrinsic: [],
    exportCount: tryAsU16(0),
  });
}

function createWorkPackage(
  anchorHash: HeaderHash,
  stateRoot: StateRootHash,
  authCodeHash: CodeHash,
  lookupAnchorSlot = 0,
) {
  return WorkPackage.create({
    authToken: BytesBlob.empty(),
    authCodeHost: AUTH_SERVICE_ID,
    authCodeHash,
    authConfiguration: BytesBlob.empty(),
    context: RefineContext.create({
      anchor: anchorHash,
      stateRoot,
      beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      lookupAnchor: anchorHash,
      lookupAnchorSlot: tryAsTimeSlot(lookupAnchorSlot),
      prerequisites: [],
    }),
    items: FixedSizeArray.new([createWorkItem(authCodeHash)], tryAsWorkItemsCount(1)),
  });
}

function hashWorkPackage(spec: ChainSpec, workPackage: WorkPackage): WithHash<WorkPackageHash, WorkPackage> {
  const workPackageHash = blake2b
    .hashBytes(Encoder.encodeObject(WorkPackage.Codec, workPackage, spec))
    .asOpaque<WorkPackageHash>();
  return new WithHash(workPackageHash, workPackage);
}

describe("InCore", () => {
  it("should return StateMissing error when anchor block state is not in DB", async () => {
    const spec = tinyChainSpec;
    const states = new InMemoryStates(spec);
    const inCore = new InCore(spec, states, PvmBackend.BuiltIn, blake2b);

    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
    const stateRoot = Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>();
    const authCodeHash = getAuthCodeHash();
    const workPackage = createWorkPackage(anchorHash, stateRoot, authCodeHash);

    const result = await inCore.refine(
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
    const inCore = new InCore(spec, states, PvmBackend.BuiltIn, blake2b);

    const authCodeHash = getAuthCodeHash();
    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
    const state = InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map([[AUTH_SERVICE_ID, createService(AUTH_SERVICE_ID, authCodeHash, AUTHORIZER_PVM)]]),
    });
    await states.insertInitialState(anchorHash, state);

    const correctStateRoot = await states.getStateRoot(state);
    const workPackage = createWorkPackage(anchorHash, correctStateRoot, authCodeHash, state.timeslot);

    const result = await inCore.refine(
      hashWorkPackage(spec, workPackage),
      tryAsCoreIndex(0),
      asKnownSize([[]]),
      asKnownSize([[]]),
    );

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);
    assert.strictEqual(result.ok.report.coreIndex, 0);
    assert.strictEqual(result.ok.report.results.length, 1);
  });
});
