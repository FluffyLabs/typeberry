import {
  Block,
  type BlockView,
  type HeaderHash,
  type HeaderView,
  headerViewWithHashCodec,
  type StateRootHash,
} from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { codec, Decoder, Encoder } from "@typeberry/codec";
import { WorkerConfig } from "@typeberry/config";
import { Finished, WorkerInit } from "@typeberry/generic-worker";
import { HASH_SIZE, type WithHash, ZERO_HASH } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU32 } from "@typeberry/numbers";
import {
  Listener,
  type RespondAndTransitionTo,
  State,
  StateMachine,
  type TransitionTo,
  type TypedChannel,
} from "@typeberry/state-machine";
import { StateEntries } from "@typeberry/state-merkleization";
import { Result, resultToString } from "@typeberry/utils";
import type { Importer } from "./importer.js";

export type ImporterInit = WorkerInit<ImporterReady>;
export type ImporterStates = ImporterInit | ImporterReady | Finished;

export function importerStateMachine() {
  const initialized = new WorkerInit<ImporterReady>("ready(importer)", WorkerConfig.reInit);
  const ready = new ImporterReady();
  const finished = new Finished();

  return new StateMachine("importer", initialized, [initialized, ready, finished]);
}

const logger = Logger.new(import.meta.filename, "importer");

export const importBlockResultCodec = codec.custom<Result<StateRootHash, string>>(
  {
    name: "Result<StateRootHash, string>",
    sizeHint: { bytes: 1, isExact: false },
  },
  (e, x) => {
    e.varU32(tryAsU32(x.isOk ? 0 : 1));
    if (x.isOk) {
      e.bytes(x.ok);
    } else {
      e.bytesBlob(BytesBlob.blobFromString(`${x.error}`));
    }
  },
  (d) => {
    const kind = d.varU32();
    if (kind === 0) {
      const hash = d.bytes(HASH_SIZE);
      return Result.ok(hash.asOpaque<StateRootHash>());
    }
    if (kind === 1) {
      const error = d.bytesBlob();
      return Result.error(error.asText(), () => error.asText());
    }

    throw new Error(`Invalid Result: ${kind}`);
  },
  (s) => {
    const kind = s.decoder.varU32();
    if (kind === 0) {
      s.bytes(HASH_SIZE);
    } else if (kind === 1) {
      s.bytesBlob();
    } else {
      throw new Error(`Invalid Result: ${kind}`);
    }
  },
);

export class MainReady extends State<"ready(main)", Finished, WorkerConfig> {
  public readonly onBestBlock = new Listener<WithHash<HeaderHash, HeaderView>>();

  constructor() {
    super({
      name: "ready(main)",
      allowedTransitions: ["finished"],
      signalListeners: {
        bestBlock: (block) => this.triggerBestBlock(block) as undefined,
      },
    });
  }

  getConfig(): WorkerConfig {
    if (this.data === null) {
      throw new Error("Did not receive chain spec config!");
    }

    return this.data;
  }

  triggerBestBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      const config = this.getConfig();
      const headerWithHash = Decoder.decodeObject(headerViewWithHashCodec, block, config.chainSpec);
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

  async importBlock(port: TypedChannel, block: Uint8Array): Promise<Result<StateRootHash, string>> {
    const res: Uint8Array | null = await port.sendRequest("importBlock", block, []);
    if (res instanceof Uint8Array) {
      return Decoder.decodeObject(importBlockResultCodec, res);
    }
    return Result.error("Invalid worker response.", () => "Invalid worker response: expected Uint8Array");
  }

  async getStateEntries(port: TypedChannel, hash: Uint8Array): Promise<StateEntries | null> {
    const res: Uint8Array | null = await port.sendRequest("getStateEntries", hash, [hash.buffer as ArrayBuffer]);
    if (res instanceof Uint8Array) {
      return Decoder.decodeObject(StateEntries.Codec, res);
    }
    return null;
  }

  async getBestStateRootHash(port: TypedChannel): Promise<StateRootHash> {
    const res: Uint8Array | null = await port.sendRequest("getBestStateRootHash", undefined);
    if (res instanceof Uint8Array) {
      return Bytes.fromBlob(res, HASH_SIZE).asOpaque();
    }

    logger.error`Invalid response for getBestStateRootHash. Expected Uint8Array, got: ${res}`;
    return Bytes.zero(HASH_SIZE).asOpaque();
  }

  finish(channel: TypedChannel): TransitionTo<Finished> {
    this.onBestBlock.markDone();
    const promise = channel.sendRequest<null>("finish", null);
    return { state: "finished", data: promise };
  }
}

export class ImporterReady extends State<"ready(importer)", Finished, WorkerConfig> {
  public readonly onBlock = new Listener<BlockView>();
  private importer: Importer | null = null;
  private readonly onImporter = new Listener<void>();

  constructor() {
    super({
      name: "ready(importer)",
      allowedTransitions: ["finished"],
      requestHandlers: {
        importBlock: async (block) => await this.importBlock(block),
        getStateEntries: async (hash) => await this.getStateEntries(hash),
        getBestStateRootHash: () => this.getBestStateRootHash(),
        finish: async () => this.endWork(),
      },
      signalListeners: {
        block: (block) => this.triggerOnBlock(block) as undefined,
      },
    });
  }

  setImporter(importer: Importer) {
    this.importer = importer;
    this.onImporter.emit();
  }

  setConfig(config: WorkerConfig) {
    this.data = config;
  }

  getConfig(): WorkerConfig {
    if (this.data === null) {
      throw new Error("Did not receive chain spec config!");
    }

    return this.data;
  }

  announce(sender: TypedChannel, headerWithHash: WithHash<HeaderHash, HeaderView>) {
    const config = this.getConfig();
    const encoded = Encoder.encodeObject(headerViewWithHashCodec, headerWithHash, config.chainSpec).raw;
    sender.sendSignal("bestBlock", encoded, [encoded.buffer as ArrayBuffer]);
  }

  async getStateEntries(hash: unknown): Promise<RespondAndTransitionTo<unknown, Finished>> {
    if (this.importer === null) {
      logger.error`${this.constructor.name} importer not initialized yet!`;
      await new Promise((resolve) => {
        this.onImporter.once(resolve);
      });
      return this.getStateEntries(hash);
    }

    if (hash instanceof Uint8Array) {
      const headerHash: HeaderHash = Bytes.fromBlob(hash, HASH_SIZE).asOpaque();
      const stateEntries = this.importer.getStateEntries(headerHash);
      const encoded = Encoder.encodeObject(StateEntries.Codec, stateEntries ?? StateEntries.fromEntriesUnsafe([]));
      return {
        response: encoded.raw,
      };
    }

    logger.error`${this.constructor.name} got invalid request type: ${JSON.stringify(hash)}.`;
    return {
      response: null,
    };
  }

  async getBestStateRootHash(): Promise<RespondAndTransitionTo<Uint8Array, Finished>> {
    // importer not ready yet, so wait for it.
    if (this.importer === null) {
      await new Promise((resolve) => {
        this.onImporter.once(resolve);
      });
      return this.getBestStateRootHash();
    }

    const rootHash = this.importer.getBestStateRootHash();
    return {
      response: rootHash === null ? Bytes.zero(HASH_SIZE).raw : rootHash.raw,
    };
  }

  async importBlock(block: unknown): Promise<RespondAndTransitionTo<Uint8Array | null, Finished>> {
    if (this.importer === null) {
      logger.error`${this.constructor.name} importer not initialized yet!`;
      await new Promise((resolve) => {
        this.onImporter.once(resolve);
      });
      return this.importBlock(block);
    }

    if (block instanceof Uint8Array) {
      const config = this.getConfig();
      const blockView = Decoder.decodeObject(Block.Codec.View, block, config.chainSpec);
      let response: Result<StateRootHash, string>;
      try {
        const res = await this.importer.importBlock(blockView, config.omitSealVerification);
        if (res.isOk) {
          response = Result.ok(this.importer.getBestStateRootHash() ?? ZERO_HASH.asOpaque());
        } else {
          response = Result.error(resultToString(res), () => resultToString(res));
        }
      } catch (e) {
        logger.error`Failed to import block: ${e}`;
        logger.error`${e instanceof Error ? e.stack : ""}`;
        response = Result.error(`${e}`, () => `${e}`);
      }
      const encoded = Encoder.encodeObject(importBlockResultCodec, response);
      return {
        response: encoded.raw,
      };
    }

    logger.error`${this.constructor.name} got invalid request type: ${JSON.stringify(block)}.`;
    return {
      response: null,
    };
  }

  private triggerOnBlock(block: unknown) {
    if (block instanceof Uint8Array) {
      const config = this.getConfig();
      const blockView = Decoder.decodeObject(Block.Codec.View, block, config.chainSpec);
      this.onBlock.emit(blockView);
    } else {
      logger.error`${this.constructor.name} got invalid signal type: ${JSON.stringify(block)}.`;
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
