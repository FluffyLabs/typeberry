import { Interpreter, tryAsGas } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 35, 173, 101, 126, 173, 255, 239, 101, 101, 101, 101, 101, 194, 101, 101, 101, 174, 120, 44, 0, 0, 0, 0, 178,
  230, 174, 73, 44, 0, 0, 0, 0, 178, 230, 174, 120, 73, 85, 65, 2, 4,
]);
pvm.reset(program, 0, tryAsGas(200n));
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
