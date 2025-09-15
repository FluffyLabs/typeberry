import { describe, it } from "node:test";
import { tryAsServiceId } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, keccak } from "@typeberry/hash";
import type { MmrHasher, MmrPeaks } from "@typeberry/mmr";
import { BlockState, type BlocksState, MAX_RECENT_HISTORY, RecentBlocks, RecentBlocksHistory } from "@typeberry/state";
import { asOpaqueType, check, deepEqual } from "@typeberry/utils";
import {
  RecentHistory,
  type RecentHistoryInput,
  type RecentHistoryPartialInput,
  type RecentHistoryState,
} from "./recent-history.js";
import { copyAndUpdateState } from "./test.utils.js";

const hasher: Promise<MmrHasher<KeccakHash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat: (a, b) => keccak.hashBlobs(hasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(hasher, [id, a, b]),
  };
});

const asRecentHistory = (arr: BlocksState, accumulationLog?: MmrPeaks<KeccakHash>): RecentHistoryState => {
  check(arr.length <= MAX_RECENT_HISTORY, "Invalid size of the state input.");
  return {
    recentBlocks: RecentBlocksHistory.create(
      RecentBlocks.create({
        blocks: arr as BlocksState,
        accumulationLog: accumulationLog ?? {
          peaks: [],
        },
      }),
    ),
  };
};

describe("Recent History", () => {
  it("should perform a transition with empty state", async () => {
    const initialState: BlocksState = asOpaqueType([]);
    const recentHistory = new RecentHistory(await hasher, asRecentHistory(initialState));
    const partialInput: RecentHistoryPartialInput = {
      priorStateRoot: Bytes.fill(HASH_SIZE, 3).asOpaque(),
    };
    const partialUpdate = recentHistory.partialTransition(partialInput);
    const input: RecentHistoryInput = {
      partial: partialUpdate,
      headerHash: Bytes.fill(HASH_SIZE, 2).asOpaque(),
      accumulationOutputLog: [{ serviceId: tryAsServiceId(0), output: Bytes.fill(HASH_SIZE, 1).asOpaque() }],
      workPackages: HashDictionary.new(),
    };
    const stateUpdate = await recentHistory.transition(input);
    const state = copyAndUpdateState(recentHistory.state, stateUpdate);

    deepEqual(
      state.recentBlocks.asCurrent(),
      RecentBlocks.create({
        blocks: asOpaqueType([
          BlockState.create({
            headerHash: input.headerHash,
            accumulationResult: Bytes.parseBytes(
              "0xc0fd15b831ff9ffa5cadc725c4fb35201f4d1a834a61b01ed9d14106c73e9990",
              HASH_SIZE,
            ),
            postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
            reported: HashDictionary.new(),
          }),
        ]),
        accumulationLog: {
          peaks: [Bytes.parseBytes("0xc0fd15b831ff9ffa5cadc725c4fb35201f4d1a834a61b01ed9d14106c73e9990", HASH_SIZE)],
        },
      }),
    );
  });

  it("should perform a transition with some state", async () => {
    const firstBlock = BlockState.create({
      headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
      accumulationResult: Bytes.fill(HASH_SIZE, 2),
      postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      reported: HashDictionary.new<WorkPackageHash, WorkPackageInfo>(),
    });
    const recentHistory = new RecentHistory(
      await hasher,
      asRecentHistory(asOpaqueType([firstBlock]), { peaks: [Bytes.fill(HASH_SIZE, 1)] }),
    );
    const partialInput: RecentHistoryPartialInput = {
      priorStateRoot: Bytes.fill(HASH_SIZE, 4).asOpaque(),
    };
    const partialUpdate = recentHistory.partialTransition(partialInput);
    const input: RecentHistoryInput = {
      partial: partialUpdate,
      headerHash: Bytes.fill(HASH_SIZE, 5).asOpaque(),
      accumulationOutputLog: [{ serviceId: tryAsServiceId(0), output: Bytes.fill(HASH_SIZE, 6).asOpaque() }],
      workPackages: HashDictionary.fromEntries(
        [
          {
            workPackageHash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
            segmentTreeRoot: Bytes.fill(HASH_SIZE, 8).asOpaque(),
          },
        ].map((x) => [x.workPackageHash, x]),
      ),
    };
    const stateUpdate = await recentHistory.transition(input);
    const state = copyAndUpdateState(recentHistory.state, stateUpdate);

    const recentBlocks = state.recentBlocks.asCurrent();
    deepEqual(recentBlocks.blocks.length, 2);
    deepEqual(
      recentBlocks.blocks[0],
      BlockState.create({
        ...firstBlock,
        // note we fill it up from the input
        postStateRoot: partialInput.priorStateRoot,
      }),
    );
    deepEqual(recentBlocks.accumulationLog, {
      peaks: [null, Bytes.parseBytes("0xf6553f33681e0bbab7c1a8385fc56f87a3310d99ceaa9667ad6d08ee86b68eee", HASH_SIZE)],
    });
    deepEqual(
      recentBlocks.blocks[1],
      BlockState.create({
        headerHash: input.headerHash,
        accumulationResult: Bytes.parseBytes(
          "0xf6553f33681e0bbab7c1a8385fc56f87a3310d99ceaa9667ad6d08ee86b68eee",
          HASH_SIZE,
        ),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: input.workPackages,
      }),
    );
  });

  it("should only keep 8 entries", async () => {
    let input!: RecentHistoryInput;
    const initialState: BlocksState = asOpaqueType([]);
    let state = asRecentHistory(initialState);

    for (let i = 0; i < 10; i++) {
      const recentHistory = new RecentHistory(await hasher, state);
      const id = (x: number) => 10 * i + x;
      const partialInput: RecentHistoryPartialInput = {
        priorStateRoot: Bytes.fill(HASH_SIZE, 1).asOpaque(),
      };
      const partialUpdate = recentHistory.partialTransition(partialInput);
      input = {
        partial: partialUpdate,
        headerHash: Bytes.fill(HASH_SIZE, id(2)).asOpaque(),
        accumulationOutputLog: [{ serviceId: tryAsServiceId(0), output: Bytes.fill(HASH_SIZE, 3).asOpaque() }],
        workPackages: HashDictionary.fromEntries(
          [
            {
              workPackageHash: Bytes.fill(HASH_SIZE, id(4)).asOpaque(),
              segmentTreeRoot: Bytes.fill(HASH_SIZE, id(5)).asOpaque(),
            },
          ].map((x) => [x.workPackageHash, x]),
        ),
      };
      const stateUpdate = await recentHistory.transition(input);
      state = copyAndUpdateState(recentHistory.state, stateUpdate);
    }

    const recentBlocks = state.recentBlocks.asCurrent();
    deepEqual(recentBlocks.blocks.length, 8);
    deepEqual(recentBlocks.accumulationLog, {
      peaks: [
        null,
        Bytes.parseBytes("0x202c128fe0f7c1a1fb34773c605998c176b1b2b888d446acbf9a6a0f7c13ad27", HASH_SIZE),
        null,
        Bytes.parseBytes("0xeb970b73bf081e5e8ff4c310791346a6a708b8a9d44f5d953b7e634ff6046ca4", HASH_SIZE),
      ],
    });
  });
});
