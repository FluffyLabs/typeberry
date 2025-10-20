// biome-ignore-all lint/suspicious/noConsole: bin file

import { Status, tryAsGas } from "@typeberry/pvm-interface";
import { Interpreter } from "@typeberry/pvm-interpreter";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 35, 173, 101, 126, 173, 255, 239, 101, 101, 101, 101, 101, 194, 101, 101, 101, 174, 120, 44, 0, 0, 0, 0, 178,
  230, 174, 73, 44, 0, 0, 0, 0, 178, 230, 174, 120, 73, 85, 65, 2, 4,
]);
pvm.resetGeneric(program, 0, tryAsGas(200n));
const instructions = pvm.printProgram();

let i = 0;
while (pvm.nextStep() === Status.OK) {
  console.info(`Instruction ${i}: ${instructions[i]}`);
  console.info(`Registers: ${pvm.getRawRegisters().getAllU64()}`);
  console.info(`Status: ${pvm.getStatus()}`);
  console.info(`Gas: ${pvm.getGasCounter().get()}`);
  console.info(`Gas: ${pvm.getPC()}`);
  console.info();
  i++;
}
console.info(`Instruction ${i}: ${instructions[i]}`);
console.info(`Registers: ${pvm.getRawRegisters().getAllU64()}`);
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGasCounter().get()}`);
console.info(`Gas: ${pvm.getPC()}`);
