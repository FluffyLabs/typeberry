import {
  Block,
  type BlockView,
  type HeaderHash,
  type HeaderView,
  type StateRootHash,
  headerViewWithHashCodec,
} from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { TruncatedHashDictionary } from "@typeberry/collections";
import { WorkerConfig } from "@typeberry/config";
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
import { StateEntries, type TruncatedEntries, truncatedEntriesCodec } from "@typeberry/state-merkleization";
import { resultToString } from "@typeberry/utils";
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

  async importBlock(port: TypedChannel, block: Uint8Array): Promise<StateRootHash | null> {
    const res: Uint8Array | null = await port.sendRequest("importBlock", block, [block.buffer as ArrayBuffer]);
    if (res instanceof Uint8Array) {
      return Bytes.fromBlob(res, HASH_SIZE).asOpaque();
    }
    return null;
  }

  async getStateEntries(port: TypedChannel, hash: Uint8Array): Promise<StateEntries<TruncatedEntries> | null> {
    const res: Uint8Array | null = await port.sendRequest("getStateEntries", hash, [hash.buffer as ArrayBuffer]);
    if (res instanceof Uint8Array) {
      const entries = Decoder.decodeObject(truncatedEntriesCodec, res);
      const dict = TruncatedHashDictionary.fromEntries(entries.map(({ key, value }) => [key.asOpaque(), value]));
      return StateEntries.fromTruncatedDictionaryUnsafe(dict);
    }
    return null;
  }

  async getBestStateRootHash(port: TypedChannel): Promise<StateRootHash> {
    const res: Uint8Array | null = await port.sendRequest("getBestStateRootHash", undefined);
    if (res instanceof Uint8Array) {
      return Bytes.fromBlob(res, HASH_SIZE).asOpaque();
    }

    logger.error(`Invalid response for getBestStateRootHash. Expected Uint8Array, got: ${res}`);
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

  private async getStateEntries(hash: unknown): Promise<RespondAndTransitionTo<unknown, Finished>> {
    if (this.importer === null) {
      logger.error(`${this.constructor.name} importer not initialized yet!`);
      return {
        response: null,
      };
    }

    if (hash instanceof Uint8Array) {
      const headerHash: HeaderHash = Bytes.fromBlob(hash, HASH_SIZE).asOpaque();
      let stateEntries = this.importer.getStateEntries(headerHash);
      if (stateEntries === null) {
        stateEntries = StateEntries.fromTruncatedDictionaryUnsafe(TruncatedHashDictionary.fromEntries([]));
      }

      const encoded = Encoder.encodeObject(
        truncatedEntriesCodec,
        Array.from(stateEntries.entries.data.entries()).map(([key, value]) => ({ key, value })),
      );
      return {
        response: encoded.raw,
      };
    }

    logger.error(`${this.constructor.name} got invalid request type: ${JSON.stringify(hash)}.`);
    return {
      response: null,
    };
  }

  private async getBestStateRootHash(): Promise<RespondAndTransitionTo<Uint8Array, Finished>> {
    const rootHash = this.importer?.getBestStateRootHash() ?? null;
    return {
      response: rootHash === null ? Bytes.zero(HASH_SIZE).raw : rootHash.raw,
    };
  }

  // NOTE [ToDr] This should rather be using the import queue, instead of going directly.
  private async importBlock(block: unknown): Promise<RespondAndTransitionTo<Uint8Array | null, Finished>> {
    if (this.importer === null) {
      logger.error(`${this.constructor.name} importer not initialized yet!`);
      return {
        response: null,
      };
    }

    if (block instanceof Uint8Array) {
      const config = this.getConfig();
      const blockView = Decoder.decodeObject(Block.Codec.View, block, config.chainSpec);
      const headerView = blockView.header.view();
      const timeSlot = headerView.timeSlotIndex.materialize();
      try {
        const res = await this.importer.importBlock(blockView, null);
        if (res.isOk) {
          logger.info(`🧊 Best block: #${timeSlot} (${res.ok.hash})`);
        } else {
          logger.log(`❌ Rejected block #${timeSlot}: ${resultToString(res)}`);
        }
      } catch (e) {
        logger.error(`Failed to import block: ${e}`);
        logger.error(`${e instanceof Error ? e.stack : ""}`);
      }
      const stateRootHash = this.importer.getBestStateRootHash();
      return {
        response: stateRootHash === null ? Bytes.zero(HASH_SIZE).raw : stateRootHash.raw,
      };
    }

    logger.error(`${this.constructor.name} got invalid request type: ${JSON.stringify(block)}.`);
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
