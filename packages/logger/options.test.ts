import assert from "node:assert";
import { describe, it } from "node:test";
import {Level, findLevel} from "./options";

describe("Options.findLevel", () => {
  it("should return default level when nothing is present", () => {
    const expectedLevel = findLevel({
      defaultLevel: Level.TRACE,
      modules: new Map(),
    }, "consensus/voting");

    assert.strictEqual(expectedLevel, Level.TRACE);
  });

  it("should return specialized level", () => {
    const modules = new Map<string, Level>();
    modules.set("consensus/voting", Level.WARN);
    const expectedLevel = findLevel({
      defaultLevel: Level.TRACE,
      modules,
    }, "consensus/voting");

    assert.strictEqual(expectedLevel, Level.WARN);
  });

  it("should return specialized level when parent is defined", () => {
    const modules = new Map<string, Level>();
    modules.set("consensus", Level.ERROR);
    const expectedLevel = findLevel({
      defaultLevel: Level.TRACE,
      modules,
    }, "consensus/voting");

    assert.strictEqual(expectedLevel, Level.ERROR);
  });
});
