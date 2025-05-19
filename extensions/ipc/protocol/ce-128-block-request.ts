import { Block, type HeaderHash } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, Decoder, Encoder, codec } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { type U32, tryAsU8 } from "@typeberry/numbers";
import { WithDebug } from "@typeberry/utils";
import type { StreamHandler, StreamSender } from "../handler.js";
import type { StreamId, StreamKind } from "./stream.js";

/**
 * JAM-SNP CE-128 stream.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-128-block-request
 */

export const STREAM_KIND = 128 as StreamKind;
export enum Direction {
  AscExcl = 0,
  DescIncl = 1,
}

export class BlockRequest extends WithDebug {
  static Codec = codec.Class(BlockRequest, {
    headerHash: codec.bytes(HASH_SIZE).asOpaque<HeaderHash>(),
    direction: codec.u8.convert<Direction>(
      (i) => tryAsU8(i),
      (i) => {
        switch (i) {
          case Direction.AscExcl:
            return Direction.AscExcl;
          case Direction.DescIncl:
            return Direction.DescIncl;
          default:
            throw new Error(`Invalid 'Direction' value: ${i}`);
        }
      },
    ),
    maxBlocks: codec.u32,
  });

  static create({ headerHash, direction, maxBlocks }: CodecRecord<BlockRequest>) {
    return new BlockRequest(headerHash, direction, maxBlocks);
  }

  private constructor(
    public readonly headerHash: HeaderHash,
    public readonly direction: Direction,
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
    private readonly getBlockSequence: (hash: HeaderHash, direction: Direction, maxBlocks: U32) => Block[],
  ) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    const request = Decoder.decodeObject(BlockRequest.Codec, message);
    logger.log(`[${sender.streamId}] Client has requested: ${request}`);

    const blocks = this.getBlockSequence(request.headerHash, request.direction, request.maxBlocks);

    sender.send(Encoder.encodeObject(codec.sequenceFixLen(Block.Codec, blocks.length), blocks, this.chainSpec));
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private promiseResolvers: Map<StreamId, (value: Block[] | PromiseLike<Block[]>) => void> = new Map();
  private promiseRejectors: Map<StreamId, (reason?: unknown) => void> = new Map();

  constructor(private readonly chainSpec: ChainSpec) {}

  onStreamMessage(sender: StreamSender, message: BytesBlob): void {
    if (!this.promiseResolvers.has(sender.streamId)) {
      throw new Error("Received an unexpected message from the server.");
    }
    const blocks = Decoder.decodeSequence(Block.Codec, message, this.chainSpec);
    logger.log(`[${sender.streamId}] Server returned ${blocks.length} blocks in ${message.length} bytes of data.`);
    this.promiseResolvers.get(sender.streamId)?.(blocks);
    this.promiseResolvers.delete(sender.streamId);
  }

  onClose(streamId: StreamId) {
    this.promiseRejectors.get(streamId)?.("Stream closed.");

    this.promiseResolvers.delete(streamId);
    this.promiseRejectors.delete(streamId);
  }

  async getBlockSequence(
    sender: StreamSender,
    headerHash: HeaderHash,
    direction: Direction,
    maxBlocks: U32,
  ): Promise<Block[]> {
    if (this.promiseResolvers.has(sender.streamId)) {
      throw new Error("It is disallowed to use the same stream for multiple requests.");
    }

    return new Promise((resolve, reject) => {
      this.promiseResolvers.set(sender.streamId, resolve);
      this.promiseRejectors.set(sender.streamId, reject);

      sender.send(Encoder.encodeObject(BlockRequest.Codec, BlockRequest.create({ headerHash, direction, maxBlocks })));
      sender.close();
    });
  }
}
