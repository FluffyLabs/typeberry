import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 28, 134, 134, 134, 122, 10, 101, 101, 101, 101, 101, 101, 35, 101, 101, 42, 101, 101, 101, 101, 101, 101, 101,
  101, 101, 101, 101, 101, 101, 1, 1, 1, 1,
]);
pvm.reset(program, 0, 1000n as Gas);
pvm.printProgram();

while (pvm.nextStep() === Status.OK) {
  console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
  console.info(`Status: ${pvm.getStatus()}`);
  console.info(`Gas: ${pvm.getGas()}`);
}

console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGas()}`);
