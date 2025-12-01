import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { Compatibility, CURRENT_VERSION, DEFAULT_VERSION, GpVersion } from "./compatibility.js";

describe("GrayPaper compatibility", { concurrency: false }, () => {
  let savedVersion = CURRENT_VERSION;

  beforeEach(() => {
    savedVersion = CURRENT_VERSION;
  });

  afterEach(() => {
    Compatibility.override(savedVersion);
  });

  it("Should check with default value if env is not set", () => {
    Compatibility.override(undefined);

    const defaultVersion = DEFAULT_VERSION;
    assert.equal(Compatibility.is(defaultVersion), true);
  });

  it("Should check with env variable if env variable was set", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.is(gpVersion), true);
  });

  it("Should check an order of versions (isGreaterOrEqual)", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_7_0), true);
    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_7_1), false);
    assert.equal(Compatibility.isGreaterOrEqual(GpVersion.V0_7_2), false);
  });

  it("Should check an order of versions (isLessThan)", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    assert.equal(Compatibility.isLessThan(GpVersion.V0_7_2), true);
    assert.equal(Compatibility.isLessThan(GpVersion.V0_7_1), true);
    assert.equal(Compatibility.isLessThan(GpVersion.V0_7_0), false);
  });

  it("Should order values by versions and get the one for highest version matching", () => {
    const gpVersion = GpVersion.V0_7_1;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_7_0]: "low",
      [GpVersion.V0_7_2]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual({ fallback: "default", versions: record });

    assert.equal(result, "low");
  });

  it("Should return middle value that is greater or equal current value", () => {
    const gpVersion = GpVersion.V0_7_1;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_7_0]: "low",
      [GpVersion.V0_7_1]: "mid",
      [GpVersion.V0_7_2]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual({ fallback: "default", versions: record });

    assert.equal(result, "mid");
  });

  it("Should return highest value that is greater or equal current value", () => {
    const gpVersion = GpVersion.V0_7_2;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_7_0]: "low",
      [GpVersion.V0_7_1]: "mid",
      [GpVersion.V0_7_2]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual({ fallback: "default", versions: record });

    assert.equal(result, "high");
  });

  it("Should return default if no version is greater or equal", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    const record = {
      [GpVersion.V0_7_1]: "mid",
      [GpVersion.V0_7_2]: "high",
    };

    const result = Compatibility.selectIfGreaterOrEqual({ fallback: "default", versions: record });

    assert.equal(result, "default");
  });

  it("Should return default if record is empty", () => {
    const gpVersion = GpVersion.V0_7_0;
    Compatibility.override(gpVersion);

    const result = Compatibility.selectIfGreaterOrEqual({ fallback: "default", versions: {} });

    assert.equal(result, "default");
  });
});
