import assert from "node:assert";
import { describe, it } from "node:test";
import { Compatibility, DEFAULT_VERSION, GpVersion } from "./compatibility.js";

describe("GrayPaper compatibility", { concurrency: false }, () => {
  it("Should check with default value if env is not set", () => {
    Compatibility.override(undefined);

    const defaultVersion = DEFAULT_VERSION;
    assert.equal(Compatibility.is(defaultVersion), true);
  });

  it("Should check with env variable if env variable was set", () => {
    const gpVersion = GpVersion.V0_6_5;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.is(gpVersion), true);
  });

  it("Should check an order of versions", () => {
    const gpVersion = GpVersion.V0_6_5;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_6_4), true);
    assert.equal(Compatibility.isGreaterOrEqual(gpVersion), true);
    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_6_6), false);
    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_6_7), false);
    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_7_0), false);
  });

  it("Should return highest version value that is greater or equal", () => {
    const gpVersion = GpVersion.V0_6_7;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_6_5]: "low",
      [GpVersion.V0_6_7]: "mid",
      [GpVersion.V0_7_0]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual("default", record);

    assert.equal(result, "mid");
  });

  it("Should return highest version value that is greater or equal", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_6_5]: "low",
      [GpVersion.V0_6_7]: "mid",
      [GpVersion.V0_7_0]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual("default", record);

    assert.equal(result, "high");
  });

  it("Should return default if no version is greater or equal", () => {
    const gpVersion = GpVersion.V0_6_4;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_6_5]: "low",
      [GpVersion.V0_6_7]: "mid",
      [GpVersion.V0_7_0]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual("default", record);

    assert.equal(result, "default");
  });

  it("Should return default if record is empty", () => {
    const gpVersion = GpVersion.V0_6_4;
    Compatibility.override(gpVersion);

    const result = Compatibility.selectIfGreaterOrEqual("default", {});

    assert.equal(result, "default");
  });
});
