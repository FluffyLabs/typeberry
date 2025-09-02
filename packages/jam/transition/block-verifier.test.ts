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
import { testBlockView } from "@typeberry/block/test-helpers.js";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { HASH_SIZE, SimpleAllocator, WithHash, keccak } from "@typeberry/hash";
import { Compatibility, GpVersion, Result, deepEqual } from "@typeberry/utils";
import { BlockVerifier, BlockVerifierError } from "./block-verifier.js";
import { TransitionHasher } from "./hasher.js";

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
    } = {},
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
    db.setBestHeaderHash(header);
  };

  const prepareBlock = ({
    parentHash,
    timeSlot,
    priorStateRootHash,
    correctExtrinsic = true,
  }: {
    parentHash?: HeaderHash;
    timeSlot?: TimeSlot;
    priorStateRootHash?: StateRootHash;
    correctExtrinsic?: boolean;
  } = {}) => {
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
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, { headerHash: Bytes.fill(HASH_SIZE, 7).asOpaque() });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ parentHash: Bytes.fill(HASH_SIZE, 8).asOpaque() });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.deepStrictEqual(
      result,
      Result.error(
        BlockVerifierError.ParentNotFound,
        "Parent 0x0808080808080808080808080808080808080808080808080808080808080808 not found",
      ),
    );
  });

  it("should return InvalidTimeSlot error if current block is older than parent block", async () => {
    const timeSlot = tryAsTimeSlot(42);
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, { timeSlot });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ timeSlot: tryAsTimeSlot(timeSlot - 2) });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.deepStrictEqual(
      result,
      Result.error(BlockVerifierError.InvalidTimeSlot, "Invalid time slot index: 40, expected > 42"),
    );
  });

  it("should return InvalidExtrinsic error if current block extrinsic hash is incorrect", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb);
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ correctExtrinsic: false });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.deepStrictEqual(
      result,
      Result.error(
        BlockVerifierError.InvalidExtrinsic,
        Compatibility.isGreaterOrEqual(GpVersion.V0_6_5)
          ? "Invalid extrinsic hash: 0x0202020202020202020202020202020202020202020202020202020202020202, expected 0x0cae6b5fb28258312381144a6dd6f8996f7181d7d6ab1016ec6e8108c332f932"
          : "Invalid extrinsic hash: 0x0202020202020202020202020202020202020202020202020202020202020202, expected 0x170f8e387101ffd117ad93ef6161ef8decc3900b37c38011aef10ba3274052ae",
      ),
    );
  });

  it("should return StateRootNotFound error if posterior state root of parent hash is not set", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, {
      stateRootHash: Bytes.fill(HASH_SIZE, 6).asOpaque(),
      prepareStateRoot: false,
    });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      priorStateRootHash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.deepStrictEqual(
      result,
      Result.error(
        BlockVerifierError.StateRootNotFound,
        "Posterior state root 0x0101010101010101010101010101010101010101010101010101010101010101 not found",
      ),
    );
  });

  it("should return InvalidStateRoot error if current block priorStateRoot hash is not the same as posterior state root", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, {
      stateRootHash: Bytes.fill(HASH_SIZE, 6).asOpaque(),
      prepareStateRoot: true,
    });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      priorStateRootHash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    assert.deepStrictEqual(
      result,
      Result.error(
        BlockVerifierError.InvalidStateRoot,
        "Invalid prior state root: 0x0707070707070707070707070707070707070707070707070707070707070707, expected 0x0606060606060606060606060606060606060606060606060606060606060606 (ours)",
      ),
    );
  });

  it("should return valid header hash if all checks pass", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, { prepareStateRoot: true });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);

    const block = prepareBlock({
      correctExtrinsic: true,
    });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    const expectedResult = Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)
      ? "0x1d85cc2c4a6cf2ede21cc99f3654e27c555d9b79dfef25a6ac72b8b69651aa74"
      : "0xf02989a8c20e88609e3aec79ba7159197bc8e7b5d43e27f98c911a96b61cdcb8";
    deepEqual(result, Result.ok(Bytes.parseBytes(expectedResult, HASH_SIZE).asOpaque()));
  });
});
