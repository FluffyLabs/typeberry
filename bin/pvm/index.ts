import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([0, 0, 15, 133, 150, 146, 221, 31, 150, 101, 101, 119, 134, 255, 15, 0, 0, 101, 65, 65]);
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
