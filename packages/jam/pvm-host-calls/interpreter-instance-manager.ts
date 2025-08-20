import { Interpreter } from "@typeberry/pvm-interpreter";
import { Compatibility, GpVersion, TestSuite } from "@typeberry/utils";

type ResolveFn = (pvm: Interpreter) => void;

export class InterpreterInstanceManager {
  private instances: Interpreter[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      this.instances.push(
        new Interpreter({
          useSbrkGas: false,
          ignoreInstructionGas: !(
            Compatibility.isSuite(TestSuite.JAMDUNA, GpVersion.V0_6_5) ||
            Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
          ),
        }),
      );
    }
  }

  async getInstance(): Promise<Interpreter> {
    const instance = this.instances.pop();
    if (instance !== undefined) {
      return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: Interpreter) {
    const waiting = this.waitingQueue.shift();
    if (waiting !== undefined) {
      return waiting(pvm);
    }
    this.instances.push(pvm);
  }
}
