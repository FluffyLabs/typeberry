import { Block, type BlockView, type HeaderHash } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type CodecRecord, codec, Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb } from "@typeberry/database";
import { HASH_SIZE } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { tryAsU8, type U32 } from "@typeberry/numbers";
import { Result, WithDebug } from "@typeberry/utils";
import { type StreamHandler, type StreamId, type StreamMessageSender, tryAsStreamKind } from "./stream.js";

/**
 * JAM-SNP CE-128 stream.
 *
 * https://github.com/zdave-parity/jam-np/blob/main/simple.md#ce-128-block-request
 */

export const STREAM_KIND = tryAsStreamKind(128);

export enum Direction {
  /**
   * Ascending exclusive.
   *
   * The sequence of blocks in the response should start with a child of the given block, followed by a grandchild, and so on.
   */
  AscExcl = 0,
  /**
   * Descending inclusive.
   *
   * The sequence of blocks in the response should start with the given block, followed by its parent, grandparent, and so on.
   */
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

const logger = Logger.new(import.meta.filename, "protocol/ce-128");

export class ServerHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly getBlockSequence: (
      streamId: StreamId,
      hash: HeaderHash,
      direction: Direction,
      maxBlocks: U32,
    ) => BlockView[],
  ) {}

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    const request = Decoder.decodeObject(BlockRequest.Codec, message);
    logger.log`[${sender.streamId}] Client has requested: ${request}`;

    const blocks = this.getBlockSequence(sender.streamId, request.headerHash, request.direction, request.maxBlocks);

    sender.bufferAndSend(
      Encoder.encodeObject(codec.sequenceFixLen(Block.Codec.View, blocks.length), blocks, this.chainSpec),
    );
    sender.close();
  }

  onClose() {}
}

export class ClientHandler implements StreamHandler<typeof STREAM_KIND> {
  kind = STREAM_KIND;

  private promiseResolvers: Map<StreamId, (value: BlockView[]) => void> = new Map();
  private promiseRejectors: Map<StreamId, (reason?: unknown) => void> = new Map();

  constructor(private readonly chainSpec: ChainSpec) {}

  onStreamMessage(sender: StreamMessageSender, message: BytesBlob): void {
    if (!this.promiseResolvers.has(sender.streamId)) {
      throw new Error("Received an unexpected message from the server.");
    }
    const blocks = Decoder.decodeSequence(Block.Codec.View, message, this.chainSpec);
    logger.log`[${sender.streamId}] Server returned ${blocks.length} blocks in ${message.length} bytes of data.`;
    this.promiseResolvers.get(sender.streamId)?.(blocks);
    this.promiseResolvers.delete(sender.streamId);
  }

  onClose(streamId: StreamId) {
    this.promiseRejectors.get(streamId)?.("Stream closed.");

    this.promiseResolvers.delete(streamId);
    this.promiseRejectors.delete(streamId);
  }

  async requestBlockSequence(
    sender: StreamMessageSender,
    headerHash: HeaderHash,
    direction: Direction,
    maxBlocks: U32,
  ): Promise<BlockView[]> {
    if (this.promiseResolvers.has(sender.streamId)) {
      throw new Error("It is disallowed to use the same stream for multiple requests.");
    }

    return new Promise((resolve, reject) => {
      this.promiseResolvers.set(sender.streamId, resolve);
      this.promiseRejectors.set(sender.streamId, reject);

      sender.bufferAndSend(
        Encoder.encodeObject(BlockRequest.Codec, BlockRequest.create({ headerHash, direction, maxBlocks })),
      );
      sender.close();
    });
  }
}

/** Error when querying blocks from DB. */
export enum BlockSequenceError {
  /** We don't have the start block in our db. */
  NoStartBlock = 0,
  /** When looking up the start block from the tip of the chain it wasn't found. */
  BlockOnFork = 1,
}

/** Handle request for block sequence by looking them up in the db. */
export function handleGetBlockSequence(
  chainSpec: ChainSpec,
  blocks: BlocksDb,
  startHash: HeaderHash,
  direction: Direction,
  limit: U32,
): Result<BlockView[], BlockSequenceError> {
  const getBlockView = (hash: HeaderHash): BlockView | null => {
    const header = blocks.getHeader(hash);
    const extrinsic = blocks.getExtrinsic(hash);
    if (header === null || extrinsic === null) {
      return null;
    }
    const blockView = BytesBlob.blobFromParts(header.encoded().raw, extrinsic.encoded().raw);
    return Decoder.decodeObject(Block.Codec.View, blockView, chainSpec);
  };

  const startBlock = getBlockView(startHash);
  if (startBlock === null) {
    return Result.error(
      BlockSequenceError.NoStartBlock,
      () => `Block sequence error: start block ${startHash} not found`,
    );
  }

  if (direction === Direction.AscExcl) {
    // Since we don't have an index of all blocks, we need to start from
    // the last block and reach the `startBlock`.
    const response: HeaderHash[] = [];
    const startIndex = startBlock.header.view().timeSlotIndex.materialize();
    let currentHash = blocks.getBestHeaderHash();
    for (;;) {
      const currentHeader = blocks.getHeader(currentHash);
      // some errornuous situation, we didn't really reach the block?
      if (currentHeader === null || currentHeader.timeSlotIndex.materialize() < startIndex) {
        return Result.error(
          BlockSequenceError.BlockOnFork,
          () => `Block sequence error: start block ${startHash} appears to be on a fork`,
        );
      }
      // we have everything we need, let's return it now
      if (startHash.isEqualTo(currentHash)) {
        return Result.ok(
          response
            .reverse()
            .slice(0, limit)
            .flatMap((hash) => {
              const view = getBlockView(hash);
              return view === null ? [] : [view];
            }),
        );
      }
      // otherwise include current hash in potential response and move further down.
      response.push(currentHash);
      currentHash = currentHeader.parentHeaderHash.materialize();
    }
  }

  const response = [startBlock];
  let currentBlock = startBlock;

  // now iterate a bit over ancestor blocks
  for (let i = 0; i < limit; i++) {
    const parent = getBlockView(currentBlock.header.view().parentHeaderHash.materialize());
    if (parent === null) {
      break;
    }

    response.push(parent);
    currentBlock = parent;
  }

  return Result.ok(response);
}
