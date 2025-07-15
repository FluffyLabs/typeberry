import assert from "node:assert";
import { describe, it } from "node:test";
import { Compatibility, DEFAULT_VERSION, GpVersion } from "./compatibility.js";

describe("GrayPaper compatibility", () => {
  it("Should check with default value if env is not set", async () => {
    Compatibility.override(undefined);

    const defaultVersion = DEFAULT_VERSION;
    assert.equal(Compatibility.is(defaultVersion), true);
  });

  it("Should check with env variable if env variable was set", async () => {
    const gpVersion = GpVersion.V0_6_5;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.is(gpVersion), true);
  });
});
