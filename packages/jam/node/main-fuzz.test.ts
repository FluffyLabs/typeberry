import { describe, it } from "node:test";
import { tryAsU8 } from "@typeberry/numbers";
import { Compatibility, deepEqual, GpVersion } from "@typeberry/utils";
import { getFuzzDetails } from "./main-fuzz.js";

describe("fuzzing config", () => {
  it("should create config from current version", () => {
    if (!Compatibility.is(GpVersion.V0_7_0)) {
      return;
    }

    const fuzzDetails = getFuzzDetails();
    deepEqual(
      fuzzDetails,
      {
        nodeName: "@typeberry/jam",
        nodeVersion: {
          major: tryAsU8(0),
          minor: tryAsU8(2),
          patch: tryAsU8(0),
        },
        gpVersion: {
          major: tryAsU8(0),
          minor: tryAsU8(7),
          patch: tryAsU8(0),
        },
      },
      { ignore: ["nodeVersion.patch"] },
    );
  });
});
