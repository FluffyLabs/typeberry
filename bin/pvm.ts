import { Pvm } from "@typeberry/pvm/pvm";

const program = new Uint8Array([0, 0, 13, 4, 7, 210, 4, 5, 3, 0, 4, 7, 239, 190, 173, 222, 209, 224]);

const pvm = new Pvm(program);

pvm.printProgram();
