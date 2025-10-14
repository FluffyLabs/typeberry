import { PVMInterpreter } from "@typeberry/config-node";
import { Interpreter } from "@typeberry/pvm-interpreter";
import { AnanasInterpreter } from "@typeberry/pvm-interpreter-ananas";

type ResolveFn = (pvm: Interpreter | AnanasInterpreter) => void;

export class InterpreterInstanceManager {
  private instances: (Interpreter | AnanasInterpreter)[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number, interpreter: PVMInterpreter = PVMInterpreter.Default) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      switch (interpreter) {
        case PVMInterpreter.Default:
          this.instances.push(
            new Interpreter({
              useSbrkGas: false,
            }),
          );
          break;
        case PVMInterpreter.Ananas:
          this.instances.push(new AnanasInterpreter());
          break;
        case PVMInterpreter.DefaultAnanas:
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
