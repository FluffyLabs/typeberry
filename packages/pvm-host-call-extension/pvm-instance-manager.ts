import { Pvm } from "@typeberry/pvm";

type Instance = {
  pvm: Pvm;
  busy: boolean;
};

type ResolveFn = (pvm: Pvm) => void;

export class PvmInstanceManager {
  private instances: Pvm[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      this.instances.push(new Pvm());
    }
  }

  async getInstance(): Promise<Pvm> {
    const instance = this.instances.pop();
    if (instance) {
       return Promise.resolve(instance);
    }
    return new Promise((resolve) => {
       this.waitingQueue.push(resolve);
    });
  }

  releaseInstance(pvm: Pvm) {
    const waiting = this.waitingQueue.unshift();
    if (waiting) {
       return waiting(pvm);
    }
    this.instances.push(pvm);
  }
    
}
