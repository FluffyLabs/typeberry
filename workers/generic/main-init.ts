import type { StateData, StateNames, TypedChannel } from "@typeberry/state-machine";
import { State, StateMachine, type TransitionTo } from "@typeberry/state-machine";
import { Finished } from "./finished";

export function stateMachineMain<TReady extends State<StateNames<TReady>, Finished, StateData<TReady>>>(
  name: string,
  readyName: StateNames<TReady>,
  ready: TReady,
) {
  const init = new MainInit<TReady>(readyName);
  const finished = new Finished();

  return new StateMachine(name, init, [init, ready, finished]);
}

export class MainInit<TReady extends State<StateNames<TReady>, Finished, StateData<TReady>>> extends State<
  "init(main)",
  TReady
> {
  private readonly readyName: StateNames<TReady>;

  constructor(readyName: StateNames<TReady>) {
    super({
      name: "init(main)",
      allowedTransitions: [readyName],
    });
    this.readyName = readyName;
  }

  sendConfig(channel: TypedChannel, config: StateData<TReady>): TransitionTo<TReady> {
    channel.sendSignal("config", config);
    return { state: this.readyName, data: config };
  }
}
