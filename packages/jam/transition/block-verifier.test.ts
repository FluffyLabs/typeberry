import { describe, it } from "node:test";
import {
  Block,
  type BlockView,
  type ExtrinsicHash,
  Header,
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
import { Blake2b, HASH_SIZE, keccak, WithHash } from "@typeberry/hash";
import { deepEqual, Result } from "@typeberry/utils";
import { BlockVerifier, BlockVerifierError } from "./block-verifier.js";
import { TransitionHasher } from "./hasher.js";

const DEFAULT_HEADER_HASH = Bytes.fill(HASH_SIZE, 1).asOpaque<HeaderHash>();
const DEFAULT_EXTRINSIC_HASH = Bytes.fill(HASH_SIZE, 2).asOpaque<ExtrinsicHash>();
const DEFAULT_STATE_ROOT = Bytes.fill(HASH_SIZE, 10).asOpaque<StateRootHash>();
const DEFAULT_TIME_SLOT = tryAsTimeSlot(1);

describe("Block Verifier", async () => {
  const spec = tinyChainSpec;
  const hasher = new TransitionHasher(await keccak.KeccakHasher.create(), await Blake2b.createHasher());

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
    const baseBlock = testBlockView().materialize();
    const timeSlotIndex = timeSlot ?? DEFAULT_TIME_SLOT;
    const header = Header.create({ ...baseBlock.header, timeSlotIndex });
    const block = Block.create({ ...baseBlock, header });
    const blockView = toBlockView(block);
    const headerHashOrDefault = headerHash ?? DEFAULT_HEADER_HASH;
    const stateRoot = stateRootHash ?? DEFAULT_STATE_ROOT;
    db.insertBlock(new WithHash(headerHashOrDefault, blockView));
    if (prepareStateRoot) {
      db.setPostStateRoot(headerHashOrDefault, stateRoot);
    }
    db.setBestHeaderHash(headerHashOrDefault);
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

    const extrinsicHash = correctExtrinsic
      ? hasher.extrinsic(testBlockView().extrinsic.view()).hash
      : DEFAULT_EXTRINSIC_HASH;

    const header = Header.create({
      ...block.header,
      timeSlotIndex: timeSlot ?? tryAsTimeSlot(DEFAULT_TIME_SLOT + 1),
      parentHeaderHash: parentHash ?? DEFAULT_HEADER_HASH,
      priorStateRoot: priorStateRootHash ?? DEFAULT_STATE_ROOT,
      extrinsicHash,
    });

    return Block.create({ ...block, header });
  };

  it("should return ParentNotFound error if parent block is not found", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb, { headerHash: Bytes.fill(HASH_SIZE, 7).asOpaque() });
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ parentHash: Bytes.fill(HASH_SIZE, 8).asOpaque() });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    deepEqual(
      result,
      Result.error(
        BlockVerifierError.ParentNotFound,
        () => "Parent 0x0808080808080808080808080808080808080808080808080808080808080808 not found",
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

    deepEqual(
      result,
      Result.error(BlockVerifierError.InvalidTimeSlot, () => "Invalid time slot index: 40, expected > 42"),
    );
  });

  it("should return InvalidExtrinsic error if current block extrinsic hash is incorrect", async () => {
    const blocksDb = InMemoryBlocks.new();
    prepareBlocksDb(blocksDb);
    const blockVerifier = new BlockVerifier(hasher, blocksDb);
    const block = prepareBlock({ correctExtrinsic: false });

    const result = await blockVerifier.verifyBlock(toBlockView(block));

    deepEqual(
      result,
      Result.error(
        BlockVerifierError.InvalidExtrinsic,
        () =>
          "Invalid extrinsic hash: 0x0202020202020202020202020202020202020202020202020202020202020202, expected 0x0377c11c61a370e532ce1b18a652aecdd060a3a3a257d53dac8f8e1cb32dea98",
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

    deepEqual(
      result,
      Result.error(
        BlockVerifierError.StateRootNotFound,
        () => "Posterior state root 0x0101010101010101010101010101010101010101010101010101010101010101 not found",
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

    deepEqual(
      result,
      Result.error(
        BlockVerifierError.InvalidStateRoot,
        () =>
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

    const expectedResult = "0x81201f77f6a370731846cae2cbe3cf462c05feacebc3c546347fa4e442fd4fad";
    deepEqual(result, Result.ok(Bytes.parseBytes(expectedResult, HASH_SIZE).asOpaque()));
  });
});
