import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import type { CodeHash } from "@typeberry/block";
import { tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize, FixedSizeArray, HashDictionary } from "@typeberry/collections";
import { PvmBackend, tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, InMemoryState, PreimageItem, ServiceAccountInfo } from "@typeberry/state";
import { buildWorkPackageFetchData } from "@typeberry/transition/externalities/fetch-externalities.js";
import { AuthorizationError, IsAuthorized } from "./is-authorized.js";

function buildPackageAndFetchData(authCodeHash: CodeHash, authToken: BytesBlob, authConfiguration: BytesBlob) {
  const pkg = buildPackage(authCodeHash, authToken, authConfiguration);
  return { pkg, fetchData: buildWorkPackageFetchData(tinyChainSpec, pkg) };
}

function buildPackage(authCodeHash: CodeHash, authToken: BytesBlob, authConfiguration: BytesBlob): WorkPackage {
  const items = [
    WorkItem.create({
      service: tryAsServiceId(1),
      codeHash: Bytes.zero(HASH_SIZE).asOpaque<CodeHash>(),
      refineGasLimit: tryAsServiceGas(1_000_000),
      accumulateGasLimit: tryAsServiceGas(1_000_000),
      exportCount: tryAsU16(0),
      payload: BytesBlob.empty(),
      importSegments: asKnownSize([]),
      extrinsic: [],
    }),
  ];
  return WorkPackage.create({
    authToken,
    authCodeHost: AUTH_SERVICE_ID,
    authCodeHash,
    authConfiguration,
    context: RefineContext.create({
      anchor: Bytes.zero(HASH_SIZE).asOpaque(),
      stateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      lookupAnchor: Bytes.zero(HASH_SIZE).asOpaque(),
      lookupAnchorSlot: tryAsTimeSlot(16),
      prerequisites: [],
    }),
    items: FixedSizeArray.new(items, tryAsWorkItemsCount(1)),
  });
}

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

// Load the authorizer PVM fixture.
// This authorizer checks that authToken === authConfiguration and returns "Auth=<token>".
// https://github.com/tomusdrw/as-lan/blob/main/examples/authorizer/assembly/authorize.ts
const AUTHORIZER_PVM = BytesBlob.blobFrom(readFileSync(resolve(import.meta.dirname, "fixtures/authorizer.pvm")));

const AUTH_SERVICE_ID = tryAsServiceId(42);

function createService(serviceId: typeof AUTH_SERVICE_ID, codeHash: OpaqueHash, code: BytesBlob): InMemoryService {
  return InMemoryService.new(serviceId, {
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

describe("IsAuthorized", () => {
  const spec = tinyChainSpec;

  function getAuthCodeHash() {
    return blake2b.hashBytes(AUTHORIZER_PVM).asOpaque<CodeHash>();
  }

  function createStateWithService(codeHash: OpaqueHash, code: BytesBlob) {
    return InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map([[AUTH_SERVICE_ID, createService(AUTH_SERVICE_ID, codeHash, code)]]),
    });
  }

  it("should authorize when token matches configuration", async () => {
    const authCodeHash = getAuthCodeHash();
    const state = createStateWithService(authCodeHash, AUTHORIZER_PVM);
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);
    const token = BytesBlob.blobFromString("hello");

    const { fetchData } = buildPackageAndFetchData(authCodeHash, token, token);
    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), fetchData);

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);

    // Verify the authorization output starts with "Auth=<hello>"
    const outputStr = Buffer.from(result.ok.authorizationOutput.raw).toString("utf8");
    assert.ok(
      outputStr.startsWith("Auth=<hello>"),
      `Expected "Auth=<hello>" prefix but got "${outputStr.slice(0, 30)}"`,
    );

    // Verify the authorizer hash is H(code_hash ++ configuration)
    const expectedHash = blake2b.hashBlobs([authCodeHash, token]);
    assert.ok(result.ok.authorizerHash.isEqualTo(expectedHash), "authorizerHash should be H(code_hash || config)");

    // Verify gas was consumed
    assert.ok(Number(result.ok.authorizationGasUsed) > 0, "should have consumed some gas");
  });

  it("should authorize with empty token and configuration", async () => {
    const authCodeHash = getAuthCodeHash();
    const state = createStateWithService(authCodeHash, AUTHORIZER_PVM);
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);

    const empty = buildPackageAndFetchData(authCodeHash, BytesBlob.empty(), BytesBlob.empty());
    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), empty.fetchData);

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);
    const outputStr = Buffer.from(result.ok.authorizationOutput.raw).toString("utf8");
    assert.ok(outputStr.startsWith("Auth=<>"), `Expected "Auth=<>" prefix but got "${outputStr.slice(0, 30)}"`);
  });

  it("should fail when token does not match configuration", async () => {
    const authCodeHash = getAuthCodeHash();
    const state = createStateWithService(authCodeHash, AUTHORIZER_PVM);
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);

    const mismatch = buildPackageAndFetchData(
      authCodeHash,
      BytesBlob.blobFromString("wrong"),
      BytesBlob.blobFromString("right"),
    );
    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), mismatch.fetchData);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, AuthorizationError.PvmFailed);
  });

  it("should fail when auth code host service is missing", async () => {
    const authCodeHash = getAuthCodeHash();
    const state = InMemoryState.partial(spec, {
      timeslot: tryAsTimeSlot(16),
      services: new Map(),
    });
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);

    const missing = buildPackageAndFetchData(authCodeHash, BytesBlob.empty(), BytesBlob.empty());
    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), missing.fetchData);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, AuthorizationError.CodeNotFound);
  });

  it("should fail when auth code preimage is missing", async () => {
    const authCodeHash = getAuthCodeHash();
    // Service exists but with no preimages
    const emptyService = InMemoryService.new(AUTH_SERVICE_ID, {
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
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);

    const emptyPreimage = buildPackageAndFetchData(authCodeHash, BytesBlob.empty(), BytesBlob.empty());
    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), emptyPreimage.fetchData);

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, AuthorizationError.CodeNotFound);
  });
});
