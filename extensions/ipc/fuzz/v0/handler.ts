import type { Block, HeaderHash, StateRootHash } from "@typeberry/block";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { Logger } from "@typeberry/logger";
import { assertNever } from "@typeberry/utils";
import type { IpcHandler, IpcSender } from "../../server.js";
import {
  type KeyValue,
  type Message,
  type MessageData,
  MessageType,
  type PeerInfo,
  type SetState,
  messageCodec,
} from "./types.js";

const logger = Logger.new(import.meta.filename, "ext-ipc-fuzz");

/** https://github.com/davxy/jam-stuff/tree/main/fuzz-proto#message-types-and-expected-responses */
export interface FuzzMessageHandler {
  /** Retrieve posterior state associated to given header hash. */
  getSerializedState(value: HeaderHash): Promise<KeyValue[]>;
  /** Initialize or reset target state. */
  resetState(value: SetState): Promise<StateRootHash>;
  /** Process block and return resulting state root. */
  importBlockV0(value: Block): Promise<StateRootHash>;
  /** Handshake and versioning exchange. */
  getPeerInfoV0(value: PeerInfo): Promise<PeerInfo>;
}

export class FuzzTarget implements IpcHandler {
  constructor(
    public readonly msgHandler: FuzzMessageHandler,
    public readonly sender: IpcSender,
    public readonly spec: ChainSpec,
  ) {}

  async onSocketMessage(msg: Uint8Array): Promise<void> {
    // attempt to the decode the messsage
    const message = Decoder.decodeObject(messageCodec, msg, this.spec);
    logger.log(`[${message.type}] incoming message`);

    await processAndRespond(this.spec, message, this.msgHandler, this.sender).catch((e) => {
      logger.error(`Error while processing fuzz v0 message: ${e}`);
      logger.error(e);
      this.sender.close();
    });
    return;

    async function processAndRespond(
      spec: ChainSpec,
      message: MessageData,
      msgHandler: FuzzMessageHandler,
      sender: IpcSender,
    ) {
      // dispatch the message.
      let response: Message | null = null;
      switch (message.type) {
        case MessageType.PeerInfo: {
          const handshake = await msgHandler.getPeerInfoV0(message.value);
          response = {
            type: MessageType.PeerInfo,
            value: handshake,
          };
          break;
        }
        case MessageType.ImportBlock: {
          const stateRoot = await msgHandler.importBlockV0(message.value);
          response = {
            type: MessageType.StateRoot,
            value: stateRoot,
          };
          break;
        }
        case MessageType.SetState: {
          const stateRoot = await msgHandler.resetState(message.value);
          response = {
            type: MessageType.StateRoot,
            value: stateRoot,
          };
          break;
        }
        case MessageType.GetState: {
          const state = await msgHandler.getSerializedState(message.value);
          response = {
            type: MessageType.State,
            value: state,
          };
          break;
        }
        case MessageType.State: {
          logger.log(`--> Received unexpected 'State' message from the fuzzer. Closing.`);
          sender.close();
          return;
        }
        case MessageType.StateRoot: {
          logger.log(`--> Received unexpected 'StateRoot' message from the fuzzer. Closing.`);
          sender.close();
          return;
        }
        default: {
          logger.log(`--> Received unexpected message type ${JSON.stringify(message)} from the fuzzer. Closing.`);
          sender.close();
          try {
            assertNever(message);
          } catch {
            return;
          }
        }
      }

      if (response !== null) {
        logger.trace(`<-- responding with: ${response.type}`);
        const encoded = Encoder.encodeObject(messageCodec, response, spec);
        sender.send(encoded);
      } else {
        logger.warn(`<-- no response generated for: ${message.type}`);
      }
    }
  }

  onClose({ error }: { error?: Error }): void {
    logger.log(`Closing the handler. Reason: ${error !== undefined ? error.message : "close"}.`);
  }
}
