import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 75, 124, 252, 134, 134, 245, 181, 189, 2, 255, 146, 150, 101, 35, 0, 0, 101, 101, 20, 124, 252, 134, 134, 245,
  181, 189, 2, 255, 146, 150, 101, 35, 0, 0, 101, 101, 20, 20, 20, 20, 20, 20, 20, 20, 0, 0, 0, 134, 134, 245, 181, 189,
  2, 255, 146, 150, 101, 35, 0, 0, 101, 101, 20, 20, 20, 20, 245, 245, 61, 92, 134, 184, 101, 124, 89, 124, 65, 130, 2,
  8, 10, 96, 48, 40, 128, 2,
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
