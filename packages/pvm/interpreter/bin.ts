import { Interpreter } from ".";
import {Gas} from "./gas";

const program = new Uint8Array([
  0, 0, 18, 4, 7, 210, 4, 4, 8, 210, 4, 24, 135, 4, 0, 4, 7, 239, 190, 173, 222, 17, 25, 252,
]);

const pvm = new Interpreter();
pvm.reset(program, 0, 1000 as Gas);
pvm.printProgram();
pvm.runProgram();
