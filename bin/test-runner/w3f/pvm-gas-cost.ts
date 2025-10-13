import assert from "node:assert";
import { fromJson } from "@typeberry/block-json";
import { type FromJson, json } from "@typeberry/json-parser";
import { Interpreter, tryAsGas } from "@typeberry/pvm-interpreter";

export class PvmGasCostTest {
  static fromJson: FromJson<PvmGasCostTest> = {
    program: fromJson.uint8Array,
    block_gas_costs: json.map("string", "number"),
  };

  program!: Uint8Array;
  block_gas_costs!: Map<string, number>;
}

export async function runPvmGasCostTest(testContent: PvmGasCostTest) {
  const pvm = new Interpreter();
  pvm.reset(testContent.program, 0, tryAsGas(1000));

  const blockGasCosts = pvm.calculateBlockGasCost();

  assert.deepStrictEqual(blockGasCosts, testContent.block_gas_costs);
}
