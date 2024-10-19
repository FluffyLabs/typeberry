import { Pvm } from "@typeberry/pvm";

type Instance = {
  pvm: Pvm;
  busy: boolean;
};

type ResolveFn = (pvm: Pvm) => void;

export class PvmInstanceManager {
  private instances: Instance[] = [];
  private waitingQueue: ResolveFn[] = [];

  constructor(noOfPvmInstances: number) {
    for (let i = 0; i < noOfPvmInstances; i++) {
      this.instances.push({ pvm: new Pvm(), busy: false });
    }
  }

  async getInstance(): Promise<Pvm> {
    const findFreeInstance = (): Instance | undefined => {
      return this.instances.find((instance) => !instance.busy);
    };

    return new Promise((resolve) => {
      const freeInstance = findFreeInstance();

      if (freeInstance) {
        freeInstance.busy = true;
        resolve(freeInstance.pvm);
      } else {
        this.waitingQueue.push(resolve);
      }
    });
  }

  releaseInstance(pvm: Pvm) {
    const targetInstance = this.instances.find((inst) => inst.pvm === pvm);
    if (targetInstance) {
      targetInstance.busy = false;

      if (this.waitingQueue.length > 0) {
        const resolveFn = this.waitingQueue.shift();
        if (resolveFn) {
          targetInstance.busy = true;
          resolveFn(targetInstance.pvm);
        }
      }
    }
  }
}
