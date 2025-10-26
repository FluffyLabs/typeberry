import type { SmallGas } from "@typeberry/pvm-interface";
import { byteToOpCodeMap } from "./assemblify.js";
import { HIGHEST_INSTRUCTION_NUMBER } from "./instruction.js";

export const instructionGasMap = (() => {
  const instructionGasMap = new Array<SmallGas>(HIGHEST_INSTRUCTION_NUMBER + 1);

  for (let i = 0; i < HIGHEST_INSTRUCTION_NUMBER + 1; i++) {
    const gas = byteToOpCodeMap[i]?.gas;
    instructionGasMap[i] = gas;
  }

  return instructionGasMap;
})();
