import assert from "node:assert";
import { describe, it } from "node:test";

import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { RefineFetchExternalities } from "./refine-fetch-externalities.js";

describe("RefineFetchExternalities", () => {
  const prepareRefineData = ({ chainSpec }: { chainSpec?: ChainSpec } = {}) => {
    const defaultChainSpec = tinyChainSpec;
    return RefineFetchExternalities.new(chainSpec ?? defaultChainSpec);
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

  // Pending implementation — these should assert against real fixture values once
  // RefineFetchExternalities accepts and exposes the required refine inputs.
  it.todo("should return entropy (H₀ header hash of anchor block)");
  it.todo("should return authorizer trace");
  it.todo("should return work item extrinsic");
  it.todo("should return work item import");
  it.todo("should return work package");
  it.todo("should return authorizer");
  it.todo("should return authorization token");
  it.todo("should return refine context");
  it.todo("should return all work items");
  it.todo("should return one work item");
  it.todo("should return work item payload");
});
