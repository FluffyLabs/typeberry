import assert from "node:assert";
import { describe, it } from "node:test";
import { Instruction } from "./instruction.js";
import { instructionGasMap } from "./instruction-gas-map.js";

describe("instructionGasMap", () => {
  const instructions = Object.entries(Instruction).filter(
    (entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number",
  );

  for (const [name, instruction] of instructions) {
    it(`checks if instruction ${name} = ${instruction} is correctly mapped to gas value`, () => {
      const gasValue = instructionGasMap[instruction];
      assert.notEqual(null, gasValue);
    });
  }
});
