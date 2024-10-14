import { Block } from "@typeberry/block";
import { tinyChainSpec } from "@typeberry/block/context";
import type { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import type { TypedChannel } from "@typeberry/state-machine";
import { type RespondAndTransitionTo, State, StateMachine, type TransitionTo } from "@typeberry/state-machine";

export type MainStates = MainInitialized | MainReady | Finished;
export type WorkerStates = WorkerInitialized | WorkerReady | Finished;

export function stateMachineMain() {
  const initialized = new MainInitialized();
  const ready = new MainReady();
  const finished = new Finished();

  return new StateMachine(initialized, [initialized, ready, finished]);
}

export function stateMachineWorker() {
  const initialized = new WorkerInitialized();
  const ready = new WorkerReady();
  const finished = new Finished();

  return new StateMachine(initialized, [initialized, ready, finished]);
}

export type Config = {
  queueSize: number;
};

export class MainInitialized extends State<"initialized(main)", MainReady> {
  constructor() {
    super({
      name: "initialized(main)",
      allowedTransitions: ["ready(main)"],
    });
  }

  sendConfig(channel: TypedChannel, config: Config): TransitionTo<MainReady> {
    channel.sendSignal("config", config);
    return { state: "ready(main)" };
  }
}

const logger = Logger.new(__filename, "block-generator");

export class MainReady extends State<"ready(main)", Finished> {
  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      signalListeners: {
        block: (block) => this.onBlock(block) as undefined,
      },
    });
  }

  private onBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      const b = Decoder.decodeObject(Block.Codec, block, tinyChainSpec);
      logger.log(`${this.constructor.name} got block: "${b.toString()}"`);
    } else {
      logger.error(`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`);
    }
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class WorkerInitialized extends State<"initialized(worker)", WorkerReady> {
  constructor() {
    super({
      name: "initialized(worker)",
      allowedTransitions: ["ready(worker)"],
      signalListeners: { config: (data) => this.onConfig(data) },
    });
  }

  private onConfig(config: unknown): TransitionTo<WorkerReady> {
    logger.log("Got config, moving to ready");
    return {
      state: "ready(worker)",
      data: config as Config,
    };
  }
}

export class WorkerReady extends State<"ready(worker)", Finished, Config> {
  constructor() {
    super({
      name: "ready(worker)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
    });
  }

  sendBlock(port: TypedChannel, block: BytesBlob) {
    // TODO [ToDr] How to make a better API to pass this binary data around?
    // Currently we don't guarantee that the underlying buffer is actually `ArrayBuffer`.
    port.sendSignal("block", block.buffer, [block.buffer.buffer as ArrayBuffer]);
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

  close(channel: TypedChannel) {
    channel.close();
  }

  async waitForWorkerToFinish() {
    return this.data;
  }
}
