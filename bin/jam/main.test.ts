import { describe, it } from "node:test";
import { loadConfig } from "./main.js";

describe("JAM CLI", () => {
  it("should load dev config without crashing", () => {
    loadConfig("dev");
  });
});
