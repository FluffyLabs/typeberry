import type { HeaderHash } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { TrieNode } from "@typeberry/trie/nodes";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamId, StreamKind } from "./stream";

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
    startKey: codec.bytes(KEY_SIZE),
    endKey: codec.bytes(KEY_SIZE),
    maximumSize: codec.u32,
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

  private boundaryNodes: Map<StreamId, TrieNode[]> = new Map();
  private onResponse: Map<StreamId, (state: StateResponse) => void> = new Map();

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
  ) {
    if (isServer && (!getBoundaryNodes || !getKeyValuePairs)) {
      throw new Error("getBoundaryNodes and getKeyValuePairs are required in server mode.");
    }
  }

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    if (this.isServer) {
      logger.info(`[${sender.streamId}][server]: Received request.`);

      if (!this.getBoundaryNodes || !this.getKeyValuePairs) return;

      const request = Decoder.decodeObject(StateRequest.Codec, message);

      const boundaryNodes = this.getBoundaryNodes(request.headerHash, request.startKey, request.endKey);
      const keyValuePairs = this.getKeyValuePairs(request.headerHash, request.startKey, request.endKey);

      logger.info(`[${sender.streamId}][server]: <-- responding with boundary nodes and key value pairs.`);
      sender.send(Encoder.encodeObject(codec.sequenceVarLen(trieNodeCodec), boundaryNodes));
      sender.send(Encoder.encodeObject(StateResponse.Codec, new StateResponse(keyValuePairs)));
      sender.close();

      return;
    }

    if (!this.boundaryNodes.has(sender.streamId)) {
      this.boundaryNodes.set(sender.streamId, Decoder.decodeObject(codec.sequenceVarLen(trieNodeCodec), message));
      logger.info(`[${sender.streamId}][client]: Received boundary nodes.`);
      return;
    }

    this.onResponse.get(sender.streamId)?.(Decoder.decodeObject(StateResponse.Codec, message));
    logger.info(`[${sender.streamId}][client]: Received state values.`);
  }

  onClose(streamId: StreamId) {
    this.boundaryNodes.delete(streamId);
    this.onResponse.delete(streamId);
  }

  getStateByKey(
    sender: StreamSender,
    hash: HeaderHash,
    key: StateRequest["startKey"],
    onResponse: (state: StateResponse) => void,
  ) {
    if (this.onResponse.has(sender.streamId)) {
      throw new Error("It is disallowed to use the same stream for multiple requests.");
    }
    this.onResponse.set(sender.streamId, onResponse);
    sender.send(Encoder.encodeObject(StateRequest.Codec, new StateRequest(hash, key, key, tryAsU32(4096))));
    sender.close();
  }
}
