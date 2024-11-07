import { Block, type HeaderHash } from "@typeberry/block";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import type { U32 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler";
import type { StreamId, StreamKind } from "./stream";
import type { ChainSpec } from "@typeberry/config";

/**
 * JAM-SNP CE-128 stream.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-128-block-request
 */

export const STREAM_KIND = 128 as StreamKind;
export enum SEQUENCE_DIRECTION {
  ASC_EXCL = 0,
  DESC_INCL = 1,
}

export class BlockRequest extends WithDebug {
  static Codec = codec.Class(BlockRequest, {
    headerHash: codec.bytes(HASH_SIZE).cast(),
    direction: codec.bytes(1),
    maxBlocks: codec.u32,
  });

  static fromCodec({ headerHash, direction, maxBlocks }: CodecRecord<BlockRequest>) {
    return new BlockRequest(headerHash, direction, maxBlocks);
  }

  constructor(
    public readonly headerHash: HeaderHash,
    public readonly direction: Bytes<1>,
    public readonly maxBlocks: U32,
  ) {
    super();
  }
}

const logger = Logger.new(__filename, "protocol/ce-128");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly getBlockSequence: (hash: HeaderHash, direction: Bytes<1>, maxBlocks: U32) => Block[],
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    logger.info(`[${sender.streamId}][server]: Received request.`);

    const request = Decoder.decodeObject(BlockRequest.Codec, message);
    const blocks = this.getBlockSequence(request.headerHash, request.direction, request.maxBlocks);

    sender.send(Encoder.encodeObject(codec.sequenceFixLen(Block.Codec, blocks.length), blocks, this.chainSpec));
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private promiseResolvers: Map<StreamId, (value: Block[] | PromiseLike<Block[]>) => void> = new Map();
  // biome-ignore lint/suspicious/noExplicitAny: representing a promise rejector
  private promiseRejectors: Map<StreamId, (reason?: any) => void> = new Map();

  constructor(private readonly chainSpec: ChainSpec) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    logger.info(`[${sender.streamId}][client]: Received response.`);

    this.promiseResolvers.get(sender.streamId)?.(Decoder.decodeSequence(Block.Codec, message, this.chainSpec));
  }

  onClose(streamId: StreamId) {
    this.promiseResolvers.delete(streamId);
    this.promiseRejectors.delete(streamId);
  }

  async getBlockSequence(
    sender: StreamSender,
    hash: HeaderHash,
    direction: SEQUENCE_DIRECTION,
    maxBlocks: number,
  ): Promise<Block[]> {
    if (this.promiseResolvers.has(sender.streamId)) {
      throw new Error("It is disallowed to use the same stream for multiple requests.");
    }

    return new Promise((resolve, reject) => {
      this.promiseResolvers.set(sender.streamId, resolve);
      this.promiseRejectors.set(sender.streamId, reject);

      sender.send(
        Encoder.encodeObject(
          BlockRequest.Codec,
          new BlockRequest(hash, Bytes.fromBlob(new Uint8Array([direction]), 1), maxBlocks as U32),
        ),
      );
      sender.close();
    });
  }
}
