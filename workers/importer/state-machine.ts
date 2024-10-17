import { Block, Header, HeaderHash, WithHash, headerWithHashCodec } from "@typeberry/block";
import { ChainSpec } from "@typeberry/block/context";
import { Decoder } from "@typeberry/codec";
import { Finished, WorkerInit } from "@typeberry/generic-worker";
import { Logger } from "@typeberry/logger";
import { Listener, type TypedChannel } from "@typeberry/state-machine";
import { type RespondAndTransitionTo, State, StateMachine, type TransitionTo } from "@typeberry/state-machine";

export type ImporterInit = WorkerInit<ImporterReady>;
export type ImporterStates = ImporterInit | ImporterReady | Finished;

export function importerStateMachine() {
  const initialized = new WorkerInit<ImporterReady>("ready(importer)", (config) => new ChainSpec(config as ChainSpec));
  const ready = new ImporterReady();
  const finished = new Finished();

  return new StateMachine(initialized, [initialized, ready, finished]);
}

const logger = Logger.new(__filename, "importer");

export class MainReady extends State<"ready(main)", Finished, ChainSpec> {
  public readonly onBestBlock = new Listener<WithHash<HeaderHash, Header>>();

  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      signalListeners: {
        bestBlock: (block) => this.triggerBestBlock(block) as undefined,
      }
    });
  }

  triggerBestBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      const headerWithHash = Decoder.decodeObject(headerWithHashCodec, block);
      this.onBestBlock.emit(headerWithHash);
    }
  }

  // TODO [ToDr] This should be triggered directly from the block generator worker.
  // Currently we pass this through the main worker which is unnecessary.
  sendBlock(port: TypedChannel, block: Uint8Array) {
    // TODO [ToDr] How to make a better API to pass this binary data around?
    // Currently we don't guarantee that the underlying buffer is actually `ArrayBuffer`.
    port.sendSignal("block", block, [block.buffer as ArrayBuffer]);
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class ImporterReady extends State<"ready(importer)", Finished, ChainSpec> {
  public readonly onBlock = new Listener<Block>();

  constructor() {
    super({
      name: "ready(importer)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
      signalListeners: {
        block: (block) => this.triggerOnBlock(block) as undefined,
      },
    });
  }

  getChainSpec(): ChainSpec {
    if (!this.data) {
      throw new Error("Did not receive chain spec config!");
    }

    return this.data;
  }

  announce(sender: TypedChannel, headerWithHash: WithHash<HeaderHash, Header>) {
    sender.sendSignal('bestBlock', headerWithHash);
  }

  private triggerOnBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      // TODO [ToDr] probably we don't want to decode it here, but
      // rather use a view?
      const b = Decoder.decodeObject(Block.Codec, block, this.data);
      this.onBlock.emit(b);
    } else {
      logger.error(`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`);
    }
  }

  async endWork(): Promise<RespondAndTransitionTo<null, Finished>> {
    this.onBlock.markDone();
    return {
      response: null,
      transitionTo: { state: "finished", data: Promise.resolve(null) },
    };
  }
}
