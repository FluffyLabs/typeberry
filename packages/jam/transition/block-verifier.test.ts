import assert from "node:assert";
import { describe, it } from "node:test";
import {
  Block,
  type BlockView,
  type ExtrinsicHash,
  type HeaderHash,
  type StateRootHash,
  type TimeSlot,
  tryAsTimeSlot,
} from "@typeberry/block";
import { testBlockView } from "@typeberry/block/test-helpers";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { HASH_SIZE, SimpleAllocator, WithHash, keccak } from "@typeberry/hash";
import { BlockVerifier, BlockVerifierError } from "./block-verifier";
import { TransitionHasher } from "./hasher";

const DEFAULT_HEADER_HASH = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
const DEFAULT_EXTRINSIC_HASH = Bytes.fill(HASH_SIZE, 2).asOpaque<ExtrinsicHash>();
const DEFAULT_STATE_ROOT = Bytes.fill(HASH_SIZE, 10).asOpaque<StateRootHash>();
const DEFAULT_TIME_SLOT = tryAsTimeSlot(1);

describe("Block Verifier", async () => {
  const spec = tinyChainSpec;
  const hasher = new TransitionHasher(spec, await keccak.KeccakHasher.create(), new SimpleAllocator());

  const toBlockView = (block: Block): BlockView => {
    const encodedBlock = Encoder.encodeObject(Block.Codec, block, spec);
    const blockView = Decoder.decodeObject(Block.Codec.View, encodedBlock, spec);
    return blockView;
  };

  const prepareBlocksDb = (
    db: InMemoryBlocks,
    {
      headerHash,
      timeSlot,
      stateRootHash,
      prepareStateRoot = false,
    }: {
      headerHash?: HeaderHash;
      timeSlot?: TimeSlot;
      stateRootHash?: StateRootHash;
      prepareStateRoot?: boolean;
    } = {
      headerHash: undefined,
      timeSlot: undefined,
      stateRootHash: undefined,
    },
  ) => {
    const block = testBlockView().materialize();
    block.header.timeSlotIndex = timeSlot ?? DEFAULT_TIME_SLOT;
    const blockView = toBlockView(block);
    const header = headerHash ?? DEFAULT_HEADER_HASH;
    const stateRoot = stateRootHash ?? DEFAULT_STATE_ROOT;
    db.insertBlock(new WithHash(header, blockView));
    if (prepareStateRoot) {
      db.setPostStateRoot(header, stateRoot);
    }
    db.setBestData(header, stateRoot);
  };

  const prepareBlock = (
    {
      parentHash,
      timeSlot,
      priorStateRootHash,
      correctExtrinsic = true,
    }: {
      parentHash?: HeaderHash;
      timeSlot?: TimeSlot;
      priorStateRootHash?: StateRootHash;
      correctExtrinsic?: boolean;
    } = {
      parentHash: undefined,
      timeSlot: undefined,
      priorStateRootHash: undefined,
    },
  ) => {
    const block = testBlockView().materialize();
    block.header.timeSlotIndex = timeSlot ?? tryAsTimeSlot(DEFAULT_TIME_SLOT + 1);
    block.header.parentHeaderHash = parentHash ?? DEFAULT_HEADER_HASH;
    block.header.priorStateRoot = priorStateRootHash ?? DEFAULT_STATE_ROOT;
    if (correctExtrinsic) {
      const extrinsicHash = hasher.extrinsic(testBlockView().extrinsic.view()).hash;
      block.header.extrinsicHash = extrinsicHash;
    } else {
      block.header.extrinsicHash = DEFAULT_EXTRINSIC_HASH;
    }
    return block;
  };

  it("should return ParentNotFound error if parent block is not found", async () => {
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb, { headerHash: Bytes.fill(HASH_SIZE, 7).asOpaque<HeaderHash>() });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ parentHash: Bytes.fill(HASH_SIZE, 8).asOpaque<HeaderHash>() });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, BlockVerifierError.ParentNotFound);
  });

  it("should return InvalidTimeSlot error if current block is older than parent block", async () => {
    const timeSlot = tryAsTimeSlot(42);
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb, { timeSlot });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ timeSlot: tryAsTimeSlot(timeSlot - 2) });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    const parentHeader = blocksDb.getHeader(block.header.parentHeaderHash);
    assert(parentHeader !== null);
    assert(block.header.timeSlotIndex < parentHeader.timeSlotIndex.materialize());
    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, BlockVerifierError.InvalidTimeSlot);
  });

  it("should return InvalidExtrinsic error if current block extrinsic hash is incorrect", async () => {
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb);
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ correctExtrinsic: false });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, BlockVerifierError.InvalidExtrinsic);
  });

  it("should return StateRootNotFound error if posterior state root of parent hash is not set", async () => {
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb, {
      stateRootHash: Bytes.fill(HASH_SIZE, 6).asOpaque<StateRootHash>(),
      prepareStateRoot: false,
    });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      priorStateRootHash: Bytes.fill(HASH_SIZE, 7).asOpaque<StateRootHash>(),
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, BlockVerifierError.StateRootNotFound);
  });

  it("should return InvalidStateRoot error if current block priorStateRoot hash is not the same as posterior state root", async () => {
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb, {
      stateRootHash: Bytes.fill(HASH_SIZE, 6).asOpaque<StateRootHash>(),
      prepareStateRoot: true,
    });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      priorStateRootHash: Bytes.fill(HASH_SIZE, 7).asOpaque<StateRootHash>(),
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.error, BlockVerifierError.InvalidStateRoot);
  });

  it("should return valid header hash if all checks pass", async () => {
    const blocksDb = new InMemoryBlocks();
    prepareBlocksDb(blocksDb, { prepareStateRoot: true });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.strictEqual(result.isOk, true);
  });
});
