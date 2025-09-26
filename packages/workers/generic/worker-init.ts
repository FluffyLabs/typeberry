import { State, type StateData, type StateNames, type TransitionTo } from "@typeberry/state-machine";
import type { Finished } from "./finished.js";

export class WorkerInit<TReady extends State<StateNames<TReady>, Finished, StateData<TReady>>> extends State<
  "init(worker)",
  TReady
> {
  constructor(
    private readonly workerReadyName: StateNames<TReady>,
    private readonly handleConfig: (config: unknown) => StateData<TReady>,
  ) {
    super({
      name: "init(worker)",
      allowedTransitions: [workerReadyName],
      signalListeners: { config: (data) => this.onConfig(data) },
    });
  }

  private onConfig(config: unknown): TransitionTo<TReady> {
    return {
      state: this.workerReadyName,
      data: this.handleConfig(config),
    };
  }
}
