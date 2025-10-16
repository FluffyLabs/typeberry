import { Block, type BlockView, type HeaderHash, type HeaderView, headerViewWithHashCodec } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { codec, Decoder, Encoder } from "@typeberry/codec";
import { WorkerConfig } from "@typeberry/config";
import { type Ed25519SecretSeed, SEED_SIZE } from "@typeberry/crypto";
import { Finished, WorkerInit } from "@typeberry/generic-worker";
import { HASH_SIZE, type WithHash } from "@typeberry/hash";
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
  const initialized = new WorkerInit<NetworkReady>("ready(network)", NetworkWorkerConfig.reInit);
  const ready = new NetworkReady();
  const finished = new Finished();

  return new StateMachine("network", initialized, [initialized, ready, finished]);
}

/** Network-specific worker initialisatation. */
export class NetworkWorkerConfig {
  /**
   * Since we loose prototypes when transferring the context,
   * this function is re-initializing proper types.
   */
  static reInit(config: unknown) {
    const { genericConfig, genesisHeaderHash, key, host, port, bootnodes } = config as NetworkWorkerConfig;
    return new NetworkWorkerConfig(
      WorkerConfig.reInit(genericConfig),
      Bytes.fromBlob(genesisHeaderHash.raw, HASH_SIZE).asOpaque(),
      Bytes.fromBlob(key.raw, SEED_SIZE).asOpaque(),
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
  }: Pick<NetworkWorkerConfig, keyof NetworkWorkerConfig>) {
    return new NetworkWorkerConfig(genericConfig, genesisHeaderHash, key, host, port, bootnodes);
  }

  private constructor(
    /** Generic config. */
    public readonly genericConfig: WorkerConfig,
    /** Genesis header hash. */
    public readonly genesisHeaderHash: HeaderHash,
    /** Ed25519 private key. */
    public readonly key: Ed25519SecretSeed,
    /** Host to bind the networking to. */
    public readonly host: string,
    /** Port to bind the networking to. */
    public readonly port: number,
    /** List of bootnode addresses. */
    public readonly bootnodes: string[],
  ) {}
}

export class MainReady extends State<"ready(main)", Finished, NetworkWorkerConfig> {
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
      const config = this.getConfig();
      const blocks = Decoder.decodeObject(
        codec.sequenceVarLen(Block.Codec.View),
        block,
        config.genericConfig.chainSpec,
      );
      this.onNewBlocks.emit(blocks);
    } else {
      logger.error`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`;
    }
  }

  announceHeader(port: TypedChannel, header: WithHash<HeaderHash, HeaderView>) {
    const encoded = Encoder.encodeObject(headerViewWithHashCodec, header);
    port.sendSignal("announceHeader", encoded.raw, [encoded.raw.buffer as ArrayBuffer]);
  }

  getConfig(): NetworkWorkerConfig {
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

export class NetworkReady extends State<"ready(network)", Finished, NetworkWorkerConfig> {
  public readonly onNewHeader = new Listener<WithHash<HeaderHash, HeaderView>>();

  constructor() {
    super({
      name: "ready(network)",
      allowedTransitions: ["finished"],
      requestHandlers: { finish: async () => this.endWork() },
      signalListeners: {
        announceHeader: (header) => this.triggerHeaderAnnouncement(header) as undefined,
      },
    });
  }

  triggerHeaderAnnouncement(header: unknown): undefined {
    if (header instanceof Uint8Array) {
      const config = this.getConfig();
      const decoded = Decoder.decodeObject(headerViewWithHashCodec, header, config.genericConfig.chainSpec);
      this.onNewHeader.emit(decoded);
    } else {
      logger.error`${this.constructor.name} got invalid signal type: ${JSON.stringify(header)}.`;
    }
  }

  sendBlocks(port: TypedChannel, blocks: BlockView[]) {
    // TODO [ToDr] How to make a better API to pass this binary data around?
    // Currently we don't guarantee that the underlying buffer is actually `ArrayBuffer`.
    const config = this.getConfig();
    const encoded = Encoder.encodeObject(
      codec.sequenceVarLen(Block.Codec.View),
      blocks,
      config.genericConfig.chainSpec,
    );
    port.sendSignal("newBlocks", encoded.raw, []);
  }

  getConfig(): NetworkWorkerConfig {
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
