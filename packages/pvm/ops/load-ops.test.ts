import assert from "node:assert";
import { describe, it } from "node:test";

import { Memory } from "../memory";
import { PageMap } from "../page-map";
import { Registers } from "../registers";
import { LoadOps } from "./load-ops";

const RESULT_REGISTER = 12;

describe("LoadOps", () => {
  describe("loadImmediate", () => {
    it("should load positive number into register", () => {
      const registers = new Registers();
      const memory = new Memory(new PageMap([]), []);
      const loadOps = new LoadOps(registers, memory);
      const numberToLoad = 15;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], numberToLoad);
    });

    it("should load negative number into register", () => {
      const registers = new Registers();
      const memory = new Memory(new PageMap([]), []);
      const loadOps = new LoadOps(registers, memory);
      const numberToLoad = -1;
      const expectedUnsignedNumber = 0xff_ff_ff_ff;

      loadOps.loadImmediate(RESULT_REGISTER, numberToLoad);

      assert.strictEqual(registers.asSigned[RESULT_REGISTER], numberToLoad);
      assert.strictEqual(registers.asUnsigned[RESULT_REGISTER], expectedUnsignedNumber);
    });
  });
});
