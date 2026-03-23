import assert from "node:assert";
import { describe, it } from "node:test";

import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { tryAsU64 } from "@typeberry/numbers";
import { RefineFetchExternalities } from "./refine-fetch-externalities.js";

describe("RefineFetchExternalities", () => {
  const prepareRefineData = ({ chainSpec }: { chainSpec?: ChainSpec } = {}) => {
    const defaultChainSpec = tinyChainSpec;
    return new RefineFetchExternalities(chainSpec ?? defaultChainSpec);
  };

  it("should return different constants for different chain specs", () => {
    const tinyFetchExternalities = prepareRefineData({ chainSpec: tinyChainSpec });
    const fullFetchExternalities = prepareRefineData({ chainSpec: fullChainSpec });

    const tinyConstants = tinyFetchExternalities.constants();
    const fullConstants = fullFetchExternalities.constants();

    assert.notStrictEqual(tinyConstants.length, 0);
    assert.notStrictEqual(fullConstants.length, 0);
    assert.notDeepStrictEqual(tinyConstants, fullConstants);
  });

  it("should return null entropy", () => {
    const fetchExternalities = prepareRefineData();

    const entropy = fetchExternalities.entropy();

    assert.strictEqual(entropy, null);
  });

  it("should return null for not-yet-implemented methods", () => {
    const fetchExternalities = prepareRefineData();

    assert.strictEqual(fetchExternalities.authorizerTrace(), null);
    assert.strictEqual(fetchExternalities.workItemExtrinsic(null, tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workItemImport(null, tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workPackage(), null);
    assert.strictEqual(fetchExternalities.authorizer(), null);
    assert.strictEqual(fetchExternalities.authorizationToken(), null);
    assert.strictEqual(fetchExternalities.refineContext(), null);
    assert.strictEqual(fetchExternalities.allWorkItems(), null);
    assert.strictEqual(fetchExternalities.oneWorkItem(tryAsU64(0)), null);
    assert.strictEqual(fetchExternalities.workItemPayload(tryAsU64(0)), null);
  });
});
