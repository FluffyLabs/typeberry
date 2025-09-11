import type { Block, HeaderHash, StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { type Result, assertNever } from "@typeberry/utils";
import type { IpcHandler, IpcSender } from "../../server.js";
import type { KeyValue } from "../v0/types.js";
import {
  type ErrorMessage,
  Features,
  type Initialize,
  type Message,
  type MessageData,
  MessageType,
  type PeerInfo,
  messageCodec,
} from "./types.js";

const logger = Logger.new(import.meta.filename, "ext-ipc-fuzz-v1");

/**
 * Handler interface for v1 fuzzer protocol messages.
 * https://github.com/davxy/jam-conformance/blob/main/fuzz-proto/fuzz-v1.asn
 */
export interface FuzzMessageHandler {
  /**
   * Handshake and versioning exchange.
   * Target waits to receive the fuzzer's PeerInfo message before sending its own.
   */
  getPeerInfo(value: PeerInfo): Promise<PeerInfo>;

  /**
   * Initialize or reset target state.
   * Returns the state root of the initialized state.
   */
  initialize(header: Initialize): Promise<StateRootHash>;

  /**
   * Process block and return resulting state root.
   * May return an Error if the block import fails.
   */
  importBlock(value: Block): Promise<Result<StateRootHash, ErrorMessage>>;
  /** Retrieve posterior state associated to given header hash. */
  getState(value: HeaderHash): Promise<KeyValue[]>;
}

export class FuzzTarget implements IpcHandler {
  private sessionFeatures = 0;

  constructor(
    public readonly msgHandler: FuzzMessageHandler,
    public readonly sender: IpcSender,
    public readonly spec: ChainSpec,
  ) {}

  async onSocketMessage(msg: Uint8Array): Promise<void> {
    // attempt to the decode the messsage
    try {
      const message = Decoder.decodeObject(messageCodec, msg, this.spec);
      logger.log(`[${message.type}] incoming message`);

      await this.processAndRespond(message);
    } catch (e) {
      logger.error(`Error while processing fuzz v1 message: ${e}`);
      logger.error(`${e}`);
      if (e instanceof Error) {
        logger.error(e.stack ?? "");
      }
      this.sender.close();
    }
  }

  private async processAndRespond(message: MessageData): Promise<void> {
    let response: Message | null = null;

    switch (message.type) {
      case MessageType.PeerInfo: {
        // Handle handshake
        const ourPeerInfo = await this.msgHandler.getPeerInfo(message.value);

        // Calculate session features (intersection of both peer features)
        this.sessionFeatures = message.value.features & ourPeerInfo.features;

        logger.info(`Handshake completed. Shared features: 0b${this.sessionFeatures.toString(2)}`);
        logger.log(`Feature ancestry: ${(this.sessionFeatures & Features.Ancestry) !== 0}`);
        logger.log(`Feature fork: ${(this.sessionFeatures & Features.Fork) !== 0}`);

        response = {
          type: MessageType.PeerInfo,
          value: ourPeerInfo,
        };
        break;
      }

      case MessageType.Initialize: {
        const stateRoot = await this.msgHandler.initialize(message.value);
        response = {
          type: MessageType.StateRoot,
          value: stateRoot,
        };
        break;
      }

      case MessageType.ImportBlock: {
        const result = await this.msgHandler.importBlock(message.value);

        if (result.isOk) {
          response = {
            type: MessageType.StateRoot,
            value: result.ok,
          };
        } else {
          response = {
            type: MessageType.Error,
            value: result.error,
          };
        }
        break;
      }

      case MessageType.GetState: {
        const state = await this.msgHandler.getState(message.value);
        response = {
          type: MessageType.State,
          value: state,
        };
        break;
      }

      case MessageType.StateRoot: {
        logger.log(`--> Received unexpected 'StateRoot' message from the fuzzer. Closing.`);
        this.sender.close();
        return;
      }

      case MessageType.State: {
        logger.log(`--> Received unexpected 'State' message from the fuzzer. Closing.`);
        this.sender.close();
        return;
      }

      case MessageType.Error: {
        logger.log(`--> Received unexpected 'Error' message from the fuzzer. Closing.`);
        this.sender.close();
        return;
      }

      default: {
        logger.log(`--> Received unexpected message type ${JSON.stringify(message)} from the fuzzer. Closing.`);
        this.sender.close();
        try {
          assertNever(message);
        } catch {
          return;
        }
      }
    }

    if (response !== null) {
      logger.trace(`<-- responding with: ${response.type}`);
      const encoded = Encoder.encodeObject(messageCodec, response, this.spec);
      this.sender.send(encoded);
    } else {
      logger.warn(`<-- no response generated for: ${message.type}`);
    }
  }

  onClose({ error }: { error?: Error }): void {
    logger.log(`Closing the v1 handler. Reason: ${error !== undefined ? error.message : "close"}.`);
  }

  /** Check if a specific feature is enabled in the session */
  hasFeature(feature: number): boolean {
    return (this.sessionFeatures & feature) !== 0;
  }
}
