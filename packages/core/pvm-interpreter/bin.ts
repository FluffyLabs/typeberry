import { tryAsGas } from "@typeberry/pvm-interface";
import { Interpreter } from "./index.js";

const program = new Uint8Array([
  0, 0, 33, 51, 8, 1, 51, 9, 1, 40, 3, 0, 149, 119, 255, 81, 7, 12, 100, 138, 200, 152, 8, 100, 169, 40, 243, 100, 135,
  51, 8, 51, 9, 1, 50, 0, 73, 147, 82, 213, 0,
]);

const pvm = new Interpreter();
pvm.resetGeneric(program, 0, tryAsGas(1000));
// biome-ignore lint/suspicious/noConsole: We do want to print that.
console.table(pvm.dumpProgram());
pvm.runProgram();
