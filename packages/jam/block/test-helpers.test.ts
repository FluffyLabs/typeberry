import assert from "node:assert";
import { describe, it } from "node:test";
import {testBlockView} from "./test-helpers.js";
import {inspect} from "@typeberry/utils";

describe("test helpers", () => {
  it("block view should proper toString", () => {
    const blockView = testBlockView();
    assert.strictEqual(`${blockView}`, "View<Block>(cache: 0)");
  });

  it("block view should not fail when inspecting", () => {
    const blockView = testBlockView();
    assert.strictEqual(`${inspect(blockView)}`, "View<Block>(cache: 0)");
  });
});

