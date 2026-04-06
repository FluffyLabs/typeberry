import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert";
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

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

// Load the authorizer PVM fixture.
// This authorizer checks that authToken === authConfiguration and returns "Auth=<token>".
// Source: https://github.com/tomusdrw/as-lan/blob/12bd8fd/examples/authorizer/assembly/authorize.ts#L25
const AUTHORIZER_PVM = BytesBlob.blobFrom(readFileSync(resolve(import.meta.dirname, "fixtures/authorizer.pvm")));

const AUTH_SERVICE_ID = tryAsServiceId(42);

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

function createWorkItem(serviceId = AUTH_SERVICE_ID) {
  return WorkItem.create({
    service: serviceId,
    codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
    payload: BytesBlob.empty(),
    refineGasLimit: tryAsServiceGas(1_000_000),
    accumulateGasLimit: tryAsServiceGas(1_000_000),
    importSegments: asKnownSize([]),
    extrinsic: [],
    exportCount: tryAsU16(0),
  });
}

function createWorkPackage(opts: {
  anchorHash: HeaderHash;
  stateRoot: StateRootHash;
  lookupAnchorSlot: number;
  authCodeHash: CodeHash;
  authToken: BytesBlob;
  authConfiguration: BytesBlob;
}) {
  return WorkPackage.create({
    authToken: opts.authToken,
    authCodeHost: AUTH_SERVICE_ID,
    authCodeHash: opts.authCodeHash,
    authConfiguration: opts.authConfiguration,
    context: RefineContext.create({
      anchor: opts.anchorHash,
      stateRoot: opts.stateRoot,
      beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      lookupAnchor: opts.anchorHash,
      lookupAnchorSlot: tryAsTimeSlot(opts.lookupAnchorSlot),
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

describe("InCore authorization", () => {
  const spec = tinyChainSpec;

  function getAuthCodeHash() {
    return blake2b.hashBytes(AUTHORIZER_PVM).asOpaque<CodeHash>();
  }

  async function setup() {
    const authCodeHash = getAuthCodeHash();
    const states = new InMemoryStates(spec);
    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();

    const authService = createService(AUTH_SERVICE_ID, authCodeHash, AUTHORIZER_PVM);

    const state = InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map([[AUTH_SERVICE_ID, authService]]),
    });
    await states.insertInitialState(anchorHash, state);
    const stateRoot = await states.getStateRoot(state);

    const inCore = new InCore(spec, states, PvmBackend.BuiltIn, blake2b);
    return { states, anchorHash, stateRoot, inCore, state, authCodeHash };
  }

  it("should authorize when token matches configuration", async () => {
    const { anchorHash, stateRoot, inCore, state, authCodeHash } = await setup();
    const token = BytesBlob.blobFromString("hello");

    const wp = createWorkPackage({
      anchorHash,
      stateRoot,
      lookupAnchorSlot: state.timeslot,
      authCodeHash,
      authToken: token,
      authConfiguration: token, // same as token -> auth succeeds
    });

    const result = await inCore.refine(hashWorkPackage(spec, wp), tryAsCoreIndex(0), asKnownSize([[]]), asKnownSize([[]]));

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);
    const report = result.ok.report;

    // Verify the authorization output starts with "Auth=<hello>"
    const outputStr = Buffer.from(report.authorizationOutput.raw).toString("utf8");
    assert.ok(outputStr.startsWith("Auth=<hello>"), `Expected output to start with "Auth=<hello>" but got "${outputStr.slice(0, 30)}"`);

    // Verify the authorizer hash is H(code_hash ++ configuration)
    const expectedHash = blake2b.hashBlobs([authCodeHash, token]);
    assert.ok(report.authorizerHash.isEqualTo(expectedHash), "authorizerHash should be H(code_hash || config)");

    // Verify gas was consumed (should be > 0)
    assert.ok(Number(report.authorizationGasUsed) > 0, "should have consumed some gas");
  });

  it("should authorize with empty token and configuration", async () => {
    const { anchorHash, stateRoot, inCore, state, authCodeHash } = await setup();

    const wp = createWorkPackage({
      anchorHash,
      stateRoot,
      lookupAnchorSlot: state.timeslot,
      authCodeHash,
      authToken: BytesBlob.empty(),
      authConfiguration: BytesBlob.empty(),
    });

    const result = await inCore.refine(hashWorkPackage(spec, wp), tryAsCoreIndex(0), asKnownSize([[]]), asKnownSize([[]]));

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);
    const outputStr = Buffer.from(result.ok.report.authorizationOutput.raw).toString("utf8");
    assert.ok(outputStr.startsWith("Auth=<>"), `Expected output to start with "Auth=<>" but got "${outputStr.slice(0, 30)}"`);
  });

  it("should fail authorization when token does not match configuration", async () => {
    const { anchorHash, stateRoot, inCore, state, authCodeHash } = await setup();

    const wp = createWorkPackage({
      anchorHash,
      stateRoot,
      lookupAnchorSlot: state.timeslot,
      authCodeHash,
      authToken: BytesBlob.blobFromString("wrong"),
      authConfiguration: BytesBlob.blobFromString("right"),
    });

    const result = await inCore.refine(hashWorkPackage(spec, wp), tryAsCoreIndex(0), asKnownSize([[]]), asKnownSize([[]]));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, RefineError.AuthorizationError);
  });

  it("should fail when auth code host service is missing", async () => {
    const authCodeHash = getAuthCodeHash();
    const states = new InMemoryStates(spec);
    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();

    // State with no services at all
    const state = InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map(),
    });
    await states.insertInitialState(anchorHash, state);
    const stateRoot = await states.getStateRoot(state);
    const inCore = new InCore(spec, states, PvmBackend.BuiltIn, blake2b);

    const wp = createWorkPackage({
      anchorHash,
      stateRoot,
      lookupAnchorSlot: state.timeslot,
      authCodeHash,
      authToken: BytesBlob.empty(),
      authConfiguration: BytesBlob.empty(),
    });

    const result = await inCore.refine(hashWorkPackage(spec, wp), tryAsCoreIndex(0), asKnownSize([[]]), asKnownSize([[]]));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, RefineError.AuthorizationError);
  });

  it("should fail when auth code preimage is missing", async () => {
    const authCodeHash = getAuthCodeHash();
    const states = new InMemoryStates(spec);
    const anchorHash = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();

    // Service exists but has no preimages
    const emptyService = new InMemoryService(AUTH_SERVICE_ID, {
      info: ServiceAccountInfo.create({
        codeHash: Bytes.zero(HASH_SIZE).asOpaque<CodeHash>(),
        balance: tryAsU64(0),
        accumulateMinGas: tryAsServiceGas(0n),
        onTransferMinGas: tryAsServiceGas(0n),
        storageUtilisationBytes: tryAsU64(0),
        storageUtilisationCount: tryAsU32(0),
        gratisStorage: tryAsU64(0),
        created: tryAsTimeSlot(0),
        lastAccumulation: tryAsTimeSlot(0),
        parentService: tryAsServiceId(0),
      }),
      preimages: HashDictionary.fromEntries([]),
      lookupHistory: HashDictionary.fromEntries([]),
      storage: new Map(),
    });

    const state = InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map([[AUTH_SERVICE_ID, emptyService]]),
    });
    await states.insertInitialState(anchorHash, state);
    const stateRoot = await states.getStateRoot(state);
    const inCore = new InCore(spec, states, PvmBackend.BuiltIn, blake2b);

    const wp = createWorkPackage({
      anchorHash,
      stateRoot,
      lookupAnchorSlot: state.timeslot,
      authCodeHash,
      authToken: BytesBlob.empty(),
      authConfiguration: BytesBlob.empty(),
    });

    const result = await inCore.refine(hashWorkPackage(spec, wp), tryAsCoreIndex(0), asKnownSize([[]]), asKnownSize([[]]));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, RefineError.AuthorizationError);
  });
});
