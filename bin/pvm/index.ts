import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 20, 146, 194, 194, 194, 194, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 194, 194, 218, 1, 1, 1,
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
