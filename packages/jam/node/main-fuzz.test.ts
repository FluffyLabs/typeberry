import { describe, it } from "node:test";
import { tryAsU8 } from "@typeberry/numbers";
import { CURRENT_VERSION, deepEqual } from "@typeberry/utils";
//eslint-disable-next-line import/no-relative-packages
import pkg from "../../../package.json" with { type: "json" };
import { getFuzzDetails } from "./main-fuzz.js";

describe("fuzzing config", () => {
  it("should create config from current version", () => {
    const [m, i, p] = pkg.version.split(".").map((x) => Number.parseInt(x, 10));
    const [gpM, gpI, gpP] = CURRENT_VERSION.split(".").map((x) => Number.parseInt(x, 10));

    const fuzzDetails = getFuzzDetails();
    deepEqual(
      fuzzDetails,
      {
        nodeName: "@typeberry/jam",
        nodeVersion: {
          major: tryAsU8(m),
          minor: tryAsU8(i),
          patch: tryAsU8(p),
        },
        gpVersion: {
          major: tryAsU8(gpM),
          minor: tryAsU8(gpI),
          patch: tryAsU8(gpP),
        },
      },
      { ignore: ["nodeVersion.patch"] },
    );
  });
});
