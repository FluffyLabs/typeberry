import { Pvm } from "@typeberry/pvm";

const program = new Uint8Array([
  0, 0, 18, 4, 7, 210, 4, 4, 8, 210, 4, 24, 135, 4, 0, 4, 7, 239, 190, 173, 222, 17, 25, 252,
]);

const pvm = new Pvm(program);

pvm.printProgram();
