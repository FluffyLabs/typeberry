import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0, 0, 59, 100, 112, 100, 100, 100, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 133, 187, 187, 187,
  187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 187, 134, 187,
  187, 187, 187, 187, 187, 187, 108, 187, 187, 187, 187, 187, 181, 100, 242, 85, 146, 36, 73, 146, 4, 73, 2,
]);
pvm.reset(program, 0, 200n as Gas);
pvm.printProgram();

while (pvm.nextStep() === Status.OK) {
  console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
  console.info(`Status: ${pvm.getStatus()}`);
  console.info(`Gas: ${pvm.getGas()}`);
}

console.info(`Registers: ${pvm.getRegisters().getAllU64()}`);
console.info(`Status: ${pvm.getStatus()}`);
console.info(`Gas: ${pvm.getGas()}`);
