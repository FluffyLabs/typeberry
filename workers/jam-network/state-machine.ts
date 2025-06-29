import { Block, type BlockView, type HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder, codec } from "@typeberry/codec";
import { Config } from "@typeberry/config";
import { Finished, WorkerInit } from "@typeberry/generic-worker";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import {
  Listener,
  type RespondAndTransitionTo,
  State,
  StateMachine,
  type TransitionTo,
  type TypedChannel,
} from "@typeberry/state-machine";

export type NetworkInit = WorkerInit<NetworkReady>;
export type NetworkStates = NetworkInit | NetworkReady | Finished;

const logger = Logger.new(import.meta.filename, "net:worker");

export function networkStateMachine() {
  const initialized = new WorkerInit<NetworkReady>("ready(network)", NetworkConfig.reInit);
  const ready = new NetworkReady();
  const finished = new Finished();

  return new StateMachine("network", initialized, [initialized, ready, finished]);
}

/** Network-specific worker initialisatation. */
export class NetworkConfig {
  /**
   * Since we loose prototypes when transferring the context,
   * this function is re-initializing proper types.
   */
  static reInit(config: unknown) {
    const { genericConfig, genesisHeaderHash, key, host, port, bootnodes } = config as NetworkConfig;
    return new NetworkConfig(
      Config.reInit(genericConfig),
      Bytes.fromBlob(genesisHeaderHash.raw, HASH_SIZE).asOpaque(),
      key,
      host,
      port,
      bootnodes,
    );
  }

  static new({
    genericConfig,
    genesisHeaderHash,
    key,
    host,
    port,
    bootnodes,
  }: Pick<NetworkConfig, keyof NetworkConfig>) {
    return new NetworkConfig(genericConfig, genesisHeaderHash, key, host, port, bootnodes);
  }

  private constructor(
    /** Generic config. */
    public readonly genericConfig: Config,
    /** Genesis header hash. */
    public readonly genesisHeaderHash: HeaderHash,
    /** Ed25519 private key. */
    public readonly key: string,
    /** Host to bind the networking to. */
    public readonly host: string,
    /** Port to bind the networking to. */
    public readonly port: number,
    /** List of bootnode addresses. */
    public readonly bootnodes: string[],
  ) {}
}

export class MainReady extends State<"ready(main)", Finished, NetworkConfig> {
  public readonly onNewBlocks = new Listener<BlockView[]>();

  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      signalListeners: {
        newBlocks: (newBlocks) => this.triggerNewBlocks(newBlocks) as undefined,
      },
    });
  }

  private triggerNewBlocks(block: unknown) {
    if (block instanceof Uint8Array) {
      const blocks = Decoder.decodeObject(codec.sequenceVarLen(Block.Codec.View), block);
      this.onNewBlocks.emit(blocks);
    } else {
      logger.error(`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`);
    }
  }

  getConfig(): NetworkConfig {
    if (this.data === null) {
      throw new Error("Did not receive network config!");
    }

    return this.data;
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    this.onNewBlocks.markDone();
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class NetworkReady extends State<"ready(network)", Finished, NetworkConfig> {
  constructor() {
    super({
      name: "ready(network)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
    });
  }

  sendBlocks(port: TypedChannel, blocks: BlockView[]) {
    // TODO [ToDr] How to make a better API to pass this binary data around?
    // Currently we don't guarantee that the underlying buffer is actually `ArrayBuffer`.
    const encoded = Encoder.encodeObject(codec.sequenceVarLen(Block.Codec.View), blocks);
    port.sendSignal("block", encoded.raw, [encoded.raw.buffer as ArrayBuffer]);
  }

  getConfig(): NetworkConfig {
    if (this.data === null) {
      throw new Error("Did not receive chain spec config!");
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
