import { Interpreter } from "@typeberry/pvm-interpreter";

type ResolveFn = (pvm: Interpreter) => void;

export class InterpreterInstanceManager {
  private instances: Interpreter[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      this.instances.push(new Interpreter());
    }
  }

  async getInstance(): Promise<Interpreter> {
    const instance = this.instances.pop();
    if (instance) {
      return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: Interpreter) {
    const waiting = this.waitingQueue.shift();
    if (waiting) {
      return waiting(pvm);
    }
    this.instances.push(pvm);
  }
}
