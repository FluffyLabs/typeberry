import assert from "node:assert";
import { describe, it } from "node:test";
import { Instruction } from "../instruction";
import { terminationInstructions } from "./is-termination-instruction";

describe("terminationInstructions", () => {
  const instructions = Object.entries(Instruction).filter(
    (entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number",
  );

  for (const [name, instruction] of instructions) {
    it(`should checks if instruction ${name} = ${instruction} is correctly mapped to boolean`, () => {
      const value = terminationInstructions[instruction];
      assert.notEqual(null, value);
    });
  }
});
