import assert from "node:assert";
import { describe, it } from "node:test";
import { DEFAULT_VERSION, GpVersion } from "./compatibility.js";

describe("GrayPaper compatibility", () => {
  it("Should check with default value if env is not set", async () => {
    const { Compatibility } = await import("./compatibility.js");

    const defaultVersion = DEFAULT_VERSION;
    assert.equal(Compatibility.is(defaultVersion), true);
  });

  it("Should check with env variable if env variable was set", async () => {
    const gpVersion = GpVersion.V0_6_5;
    process.env.GP_VERSION = gpVersion;

    // NOTE: [MaSo] To trick node, reimport module with unique name
    // so it doesn't use cached module
    const { Compatibility, CURRENT_VERSION } = await import(`./compatibility.js?v=${Date.now()}`);

    assert.deepEqual(CURRENT_VERSION, gpVersion);
    assert.equal(Compatibility.is(gpVersion), true);
  });

  it("Should throw error on invalid env variable gp version", async () => {
    const gpVersion = "invalid-gp-version";
    process.env.GP_VERSION = gpVersion;

    const { Compatibility, CURRENT_VERSION } = await import(`./compatibility.js?v=${Date.now()}`);

    assert.deepEqual(CURRENT_VERSION, gpVersion);
    assert.throws(() => Compatibility.is(DEFAULT_VERSION), {
      message: "Configured environment variable GP_VERSION is unknown: 'invalid-gp-version'",
    });
  });
});
