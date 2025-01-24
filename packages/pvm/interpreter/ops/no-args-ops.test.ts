import assert from "node:assert";
import { describe, it } from "node:test";

import { InstructionResult } from "../instruction-result";
import { Result } from "../result";
import { NoArgsOps } from "./no-args-ops";

describe("NoArgsOps", () => {
  describe("trap", () => {
    it("should change status to panic", () => {
      const instructionResult = new InstructionResult();
      const noArgsOps = new NoArgsOps(instructionResult);

      noArgsOps.trap();

      assert.strictEqual(instructionResult.status, Result.TRAP);
    });
  });

  describe("fallthrough", () => {
    it("should not change anything", () => {
      const instructionResult = new InstructionResult();
      const expectedInstructionResult = new InstructionResult();
      const noArgsOps = new NoArgsOps(instructionResult);

      noArgsOps.fallthrough();

      assert.deepStrictEqual(instructionResult, expectedInstructionResult);
    });
  });
});
