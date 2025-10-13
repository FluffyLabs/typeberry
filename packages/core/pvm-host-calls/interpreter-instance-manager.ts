import { Interpreter } from "@typeberry/pvm-interpreter";
import { AnanasInterpreter } from "@typeberry/pvm-interpreter-ananas";

type ResolveFn = (pvm: Interpreter | AnanasInterpreter) => void;

export enum InterpreterKind {
  BuildIn = 0,
  Ananas = 1,
  Both = 2,
}

export class InterpreterInstanceManager {
  private instances: (Interpreter | AnanasInterpreter)[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number, interpreter: InterpreterKind = InterpreterKind.Ananas) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      switch (interpreter) {
        case InterpreterKind.BuildIn:
          this.instances.push(
            new Interpreter({
              useSbrkGas: false,
            }),
          );
          break;
        case InterpreterKind.Ananas:
          this.instances.push(new AnanasInterpreter());
          break;
        case InterpreterKind.Both:
          this.instances.push(
            new Interpreter({
              useSbrkGas: false,
            }),
          );
          this.instances.push(new AnanasInterpreter());
          break;
      }
    }
  }

  async getInstance(): Promise<Interpreter | AnanasInterpreter> {
    const instance = this.instances.pop();
    if (instance !== undefined) {
      return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: Interpreter | AnanasInterpreter) {
    const waiting = this.waitingQueue.shift();
    if (waiting !== undefined) {
      return waiting(pvm);
    }
    this.instances.push(pvm);
  }
}
