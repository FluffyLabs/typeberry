import { byteToOpCodeMap } from "./assemblify";

const HIGHEST_INSTRUCTION_NUMBER = 87;

export const instructionGasMap = new Uint8Array(HIGHEST_INSTRUCTION_NUMBER + 1);

for (let i = 0; i < HIGHEST_INSTRUCTION_NUMBER + 1; i++) {
	const gas = byteToOpCodeMap[i]?.gas;
	instructionGasMap[i] = gas ?? 0;
}
