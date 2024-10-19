import type { BytesBlob } from "@typeberry/bytes";
import { Config } from "@typeberry/config";
import { Finished, WorkerInit } from "@typeberry/generic-worker";
import { Logger } from "@typeberry/logger";
import { Listener, type TypedChannel } from "@typeberry/state-machine";
import { type RespondAndTransitionTo, State, StateMachine, type TransitionTo } from "@typeberry/state-machine";

export type GeneratorInit = WorkerInit<GeneratorReady>;
export type GeneratorStates = GeneratorInit | GeneratorReady | Finished;

export function generatorStateMachine() {
  const initialized = new WorkerInit<GeneratorReady>("ready(generator)", Config.reinit);
  const ready = new GeneratorReady();
  const finished = new Finished();

  return new StateMachine("block-generator", initialized, [initialized, ready, finished]);
}

const logger = Logger.new(__filename, "block-generator");

export class MainReady extends State<"ready(main)", Finished, Config> {
  // TODO [ToDr] should this be cleaned up at some point?
  public readonly onBlock = new Listener<Uint8Array>();

  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      signalListeners: {
        block: (block) => this.triggerOnBlock(block) as undefined,
      },
    });
  }

  private triggerOnBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      this.onBlock.emit(block);
    } else {
      logger.error(`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`);
    }
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    this.onBlock.markDone();
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class GeneratorReady extends State<"ready(generator)", Finished, Config> {
  constructor() {
    super({
      name: "ready(generator)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
    });
  }

  sendBlock(port: TypedChannel, block: BytesBlob) {
    // TODO [ToDr] How to make a better API to pass this binary data around?
    // Currently we don't guarantee that the underlying buffer is actually `ArrayBuffer`.
    port.sendSignal("block", block.buffer, [block.buffer.buffer as ArrayBuffer]);
  }

  getConfig(): Config {
    if (!this.data) {
      throw new Error("Config not received.");
    }

    return this.data;
  }

  async endWork(): Promise<RespondAndTransitionTo<null, Finished>> {
    return {
      response: null,
      transitionTo: { state: "finished", data: Promise.resolve(null) },
    };
  }
}
