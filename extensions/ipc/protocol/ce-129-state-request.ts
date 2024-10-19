import { HASH_SIZE, type HeaderHash, WithDebug } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { Logger } from "@typeberry/logger";
import type { U32 } from "@typeberry/numbers";
import { TrieNode } from "@typeberry/trie/nodes";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamKind } from "./stream";

/**
 * JAM-SNP CE-129 stream.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-129-state-request
 */

export const STREAM_KIND = 129 as StreamKind;
export const KEY_SIZE = 31;
export type KEY_SIZE = typeof KEY_SIZE;

const trieNodeCodec = codec.bytes<64>(64).convert<TrieNode>(
  (i) => Bytes.fromBlob(i.data, 64),
  (i) => new TrieNode(i.raw),
);

export class KeyValuePair extends WithDebug {
  static Codec = codec.Class(KeyValuePair, {
    key: codec.bytes(KEY_SIZE).cast(),
    value: codec.blob,
  });

  static fromCodec({ key, value }: CodecRecord<KeyValuePair>) {
    return new KeyValuePair(key, value);
  }

  constructor(
    public readonly key: Bytes<KEY_SIZE>,
    public readonly value: BytesBlob,
  ) {
    super();
  }
}

export class StateResponse extends WithDebug {
  static Codec = codec.Class(StateResponse, {
    keyValuePairs: codec.sequenceVarLen(KeyValuePair.Codec),
  });

  static fromCodec({ keyValuePairs }: CodecRecord<StateResponse>) {
    return new StateResponse(keyValuePairs);
  }

  constructor(public readonly keyValuePairs: KeyValuePair[]) {
    super();
  }
}

export class StateRequest extends WithDebug {
  static Codec = codec.Class(StateRequest, {
    headerHash: codec.bytes(HASH_SIZE).cast(),
    startKey: codec.bytes(KEY_SIZE).cast(),
    endKey: codec.bytes(KEY_SIZE).cast(),
    maximumSize: codec.u32.cast(),
  });

  static fromCodec({ headerHash, startKey, endKey, maximumSize }: CodecRecord<StateRequest>) {
    return new StateRequest(headerHash, startKey, endKey, maximumSize);
  }

  constructor(
    public readonly headerHash: HeaderHash,
    public readonly startKey: Bytes<KEY_SIZE>,
    public readonly endKey: Bytes<KEY_SIZE>,
    public readonly maximumSize: U32,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-129");

export class Handler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private boundaryNodes: TrieNode[] = [];
  private onResponse: (state: StateResponse) => void = () => {};

  constructor(
    private readonly isServer: boolean = false,
    private readonly getBoundaryNodes?: (
      hash: HeaderHash,
      startKey: Bytes<KEY_SIZE>,
      endKey: Bytes<KEY_SIZE>,
    ) => TrieNode[],
    private readonly getKeyValuePairs?: (
      hash: HeaderHash,
      startKey: Bytes<KEY_SIZE>,
      endKey: Bytes<KEY_SIZE>,
    ) => KeyValuePair[],
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    if (this.isServer) {
      logger.info(`[${sender.streamId}][server]: Received request.`);
      if (!this.getBoundaryNodes || !this.getKeyValuePairs) {
        const msg = "Tried running in server mode without defining data getters.";
        logger.error(msg);
        throw new Error(msg);
      }

      const request = Decoder.decodeObject(StateRequest.Codec, message);

      const boundaryNodes = this.getBoundaryNodes(request.headerHash, request.startKey, request.endKey);
      const keyValuePairs = this.getKeyValuePairs(request.headerHash, request.startKey, request.endKey);

      logger.info(`[${sender.streamId}][server]: <-- responding with boundary nodes and key value pairs.`);
      sender.send(Encoder.encodeObject(codec.sequenceVarLen(trieNodeCodec), boundaryNodes));
      sender.send(Encoder.encodeObject(StateResponse.Codec, new StateResponse(keyValuePairs)));

      return;
    }

    if (!this.boundaryNodes.length) {
      this.boundaryNodes = Decoder.decodeObject(codec.sequenceVarLen(trieNodeCodec), message);
      logger.info(`[${sender.streamId}][client]: Received boundary nodes.`);
      return;
    }

    this.onResponse(Decoder.decodeObject(StateResponse.Codec, message));
    logger.info(`[${sender.streamId}][client]: Received state values.`);
  }

  onClose(): void {
    this.boundaryNodes = [];
    this.onResponse = () => {};
  }

  getStateByKey(
    sender: StreamSender,
    hash: HeaderHash,
    key: StateRequest["startKey"],
    onResponse: (state: StateResponse) => void,
  ) {
    this.onResponse = onResponse;
    sender.send(Encoder.encodeObject(StateRequest.Codec, new StateRequest(hash, key, key, 4096 as U32)));
  }
}
