import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import type { CodeHash } from "@typeberry/block";
import { tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { PvmBackend, tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { InMemoryService, InMemoryState, PreimageItem, ServiceAccountInfo } from "@typeberry/state";
import { AuthorizationError, IsAuthorized } from "./is-authorized.js";

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

    const result = await isAuthorized.invoke(state, tryAsCoreIndex(0), token, AUTH_SERVICE_ID, authCodeHash, token);

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

    const result = await isAuthorized.invoke(
      state,
      tryAsCoreIndex(0),
      BytesBlob.empty(),
      AUTH_SERVICE_ID,
      authCodeHash,
      BytesBlob.empty(),
    );

    assert.strictEqual(result.isOk, true, `Expected OK but got error: ${result.isError ? result.details() : ""}`);
    const outputStr = Buffer.from(result.ok.authorizationOutput.raw).toString("utf8");
    assert.ok(outputStr.startsWith("Auth=<>"), `Expected "Auth=<>" prefix but got "${outputStr.slice(0, 30)}"`);
  });

  it("should fail when token does not match configuration", async () => {
    const authCodeHash = getAuthCodeHash();
    const state = createStateWithService(authCodeHash, AUTHORIZER_PVM);
    const isAuthorized = new IsAuthorized(spec, PvmBackend.BuiltIn, blake2b);

    const result = await isAuthorized.invoke(
      state,
      tryAsCoreIndex(0),
      BytesBlob.blobFromString("wrong"),
      AUTH_SERVICE_ID,
      authCodeHash,
      BytesBlob.blobFromString("right"),
    );

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

    const result = await isAuthorized.invoke(
      state,
      tryAsCoreIndex(0),
      BytesBlob.empty(),
      AUTH_SERVICE_ID,
      authCodeHash,
      BytesBlob.empty(),
    );

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

    const result = await isAuthorized.invoke(
      state,
      tryAsCoreIndex(0),
      BytesBlob.empty(),
      AUTH_SERVICE_ID,
      authCodeHash,
      BytesBlob.empty(),
    );

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, AuthorizationError.CodeNotFound);
  });
});
