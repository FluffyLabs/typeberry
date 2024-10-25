import { byteToOpCodeMap } from "./assemblify";
import type { SmallGas } from "./gas";
import { HIGHEST_INSTRUCTION_NUMBER } from "./instruction";

export const instructionGasMap = (() => {
  const instructionGasMap = new Array<SmallGas>(HIGHEST_INSTRUCTION_NUMBER + 1);

  for (let i = 0; i < HIGHEST_INSTRUCTION_NUMBER + 1; i++) {
    const gas = byteToOpCodeMap[i]?.gas;
    instructionGasMap[i] = gas;
  }

  return instructionGasMap;
})();
