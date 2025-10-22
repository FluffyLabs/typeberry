import { PVMBackend } from "@typeberry/config-node";
import type { IPVMInterpreter } from "@typeberry/pvm-interface";
import { Interpreter } from "@typeberry/pvm-interpreter";
import { AnanasInterpreter } from "@typeberry/pvm-interpreter-ananas";
import { assertNever } from "@typeberry/utils";

type ResolveFn = (pvm: Promise<IPVMInterpreter>) => void;

// TODO [MaSo] Delete this
export class InterpreterInstanceManager {
  private instances: Promise<IPVMInterpreter>[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number, interpreter: PVMBackend = PVMBackend.BuiltIn) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      switch (interpreter) {
        case PVMBackend.BuiltIn:
          this.instances.push(
            Interpreter.new({
              useSbrkGas: false,
            }),
          );
          break;
        case PVMBackend.Ananas:
          this.instances.push(AnanasInterpreter.new());
          break;
        default:
          assertNever(interpreter);
      }
    }
  }

  async getInstance(): Promise<IPVMInterpreter> {
    const instance = this.instances.pop();
    if (instance !== undefined) {
      return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: Promise<IPVMInterpreter>) {
    const waiting = this.waitingQueue.shift();
    if (waiting !== undefined) {
      return waiting(pvm);
    }
    this.instances.push(pvm);
  }
}
