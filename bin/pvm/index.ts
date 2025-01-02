import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 23, 1, 126, 135, 186, 135, 111, 116, 1, 1, 1, 1, 1, 121, 112, 114, 37, 116, 121, 101, 116, 111, 112, 2, 131, 31,
  20,
]);
pvm.reset(program, 0, 200n as Gas);
const instructions = pvm.printProgram();

let i = 0;
while (pvm.nextStep() === Status.OK) {
  console.info(`Instruction ${i}: ${instructions[i]}`);
  console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
  console.info(`Status: ${pvm.getStatus()}`);
  console.info(`Gas: ${pvm.getGas()}`);
  console.info(`Gas: ${pvm.getPC()}`);
  console.info();
  i++;
}
console.info(`Instruction ${i}: ${instructions[i]}`);
console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGas()}`);
console.info(`Gas: ${pvm.getPC()}`);
