import { Pvm } from "../packages/pvm/pvm";

const program = new Uint8Array([0, 0, 3, 2, 121, 2, 249]);

const pvm = new Pvm(program);

pvm.printProgram();
