import { type Gas, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";

const pvm = new Interpreter();

const program = new Uint8Array([
  0,   0,  31, 135, 111, 239, 255, 255,
  255, 255, 112, 101, 228,  99, 111, 110,
  115, 116, 114, 117,  99, 116, 111, 114,
   46, 112, 114, 111, 116, 111, 116, 121,
  112, 101,   1,   1,   1,   1
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
