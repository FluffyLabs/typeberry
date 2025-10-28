import { PvmBackend } from "@typeberry/config";
import type { IPvmInterpreter } from "@typeberry/pvm-interface";
import { Interpreter } from "@typeberry/pvm-interpreter";
import { AnanasInterpreter } from "@typeberry/pvm-interpreter-ananas";
import { assertNever } from "@typeberry/utils";

type ResolveFn = (pvm: IPvmInterpreter) => void;

// TODO [MaSo] Delete this & also make host calls independent from intepreters.
export class InterpreterInstanceManager {
  private waitingQueue: ResolveFn[] = [];

  private constructor(private readonly instances: IPvmInterpreter[]) {}

  static async new(interpreter: PvmBackend): Promise<InterpreterInstanceManager> {
    const instances: IPvmInterpreter[] = [];
    switch (interpreter) {
      case PvmBackend.BuiltIn:
        instances.push(
          new Interpreter({
            useSbrkGas: false,
          }),
        );
        break;
      case PvmBackend.Ananas:
        instances.push(await AnanasInterpreter.new());
        break;
      default:
        assertNever(interpreter);
    }
    return new InterpreterInstanceManager(instances);
  }

  async getInstance(): Promise<IPvmInterpreter> {
    const instance = this.instances.pop();
    if (instance !== undefined) {
      return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: IPvmInterpreter) {
    const waiting = this.waitingQueue.shift();
    if (waiting !== undefined) {
      return waiting(pvm);
    }
    this.instances.push(pvm);
  }
}
