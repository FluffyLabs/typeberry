import { Pvm } from "../packages/pvm/pvm";

const program = [0, 0, 3, 2, 121, 2, 249];

const pvm = new Pvm(program);

pvm.printProgram();
