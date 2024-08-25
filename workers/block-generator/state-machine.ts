import type { TypedChannel } from "./state-machine/channel";
import { type RespondAndTransitionTo, State, StateMachine, type TransitionTo } from "./state-machine/utils";

export type StatesMain = InitializedMain | ReadyMain | Finished;
export type StatesWorker = InitializedWorker | ReadyWorker | Finished;

export function stateMachineMain() {
  const initialized = new InitializedMain();
  const ready = new ReadyMain();
  const finished = new Finished();

  return new StateMachine(initialized, [initialized, ready, finished]);
}

export function stateMachineWorker() {
  const initialized = new InitializedWorker();
  const ready = new ReadyWorker();
  const finished = new Finished();

  return new StateMachine(initialized, [initialized, ready, finished]);
}

export type Config = {
  queueSize: number;
};

export class InitializedMain extends State<"initialized(main)", ReadyMain> {
  constructor() {
    super({
      name: "initialized(main)",
      allowedTransitions: ["ready(main)"],
    });
  }

  sendConfig(channel: TypedChannel, config: Config): TransitionTo<ReadyMain> {
    channel.sendMessage("config", config);
    return { state: "ready(main)" };
  }
}

export class ReadyMain extends State<"ready(main)", Finished> {
  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      messageListeners: {
        block: (block) => this.onBlock(block) as undefined,
      },
    });
  }

  private onBlock(block: unknown) {
    console.log(`${this.constructor.name} got block`, block);
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class InitializedWorker extends State<"initialized(worker)", ReadyWorker> {
  constructor() {
    super({
      name: "initialized(worker)",
      allowedTransitions: ["ready(worker)"],
      messageListeners: { config: (data) => this.onConfig(data) },
    });
  }

  private onConfig(config: unknown): TransitionTo<ReadyWorker> {
    console.log("Got config, moving to ready");
    return {
      state: "ready(worker)",
      data: config as Config,
    };
  }
}

export class ReadyWorker extends State<"ready(worker)", Finished, Config> {
  constructor() {
    super({
      name: "ready(worker)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
    });
  }

  sendBlock(port: TypedChannel, block: { number: number }) {
    port.sendMessage("block", block);
  }

  async endWork(): Promise<RespondAndTransitionTo<null, Finished>> {
    return {
      response: null,
      transitionTo: { state: "finished", data: Promise.resolve(null) },
    };
  }
}

export class Finished extends State<"finished", never, Promise<null>> {
  constructor() {
    super({
      name: "finished",
    });
  }

  async waitForWorkerToFinish() {
    return this.data;
  }
}
