import assert from "node:assert";
import { fromJson } from "@typeberry/block-json";
import { type FromJson, json } from "@typeberry/json-parser";
import { Interpreter, tryAsGas } from "@typeberry/pvm-interpreter";

function isPlainObject(value: unknown): value is object {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isBlockCostObject(value: unknown): value is Record<string, number> {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const values = Object.values(value);
    return keys.every((k) => typeof k === "string") && values.every((val) => typeof val === "number");
  }
  return false;
}
export class PvmGasCostTest {
  static fromJson: FromJson<PvmGasCostTest> = {
    program: fromJson.uint8Array,
    block_gas_costs: json.fromAny((v) => {
      if (isBlockCostObject(v)) {
        return v;
      }

      throw new Error(`Expected an object, got ${typeof v} instead.`);
    }),
  };

  program!: Uint8Array;
  block_gas_costs!: Record<string, number>;
}

export async function runPvmGasCostTest(testContent: PvmGasCostTest) {
  const pvm = new Interpreter();
  pvm.reset(testContent.program, 0, tryAsGas(1000));

  const blockGasCosts = pvm.calculateBlockGasCost();

  assert.deepStrictEqual(blockGasCosts, testContent.block_gas_costs);
}
