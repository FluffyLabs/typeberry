import assert from "node:assert";
import { describe, it } from "node:test";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type KeccakHash, keccak } from "@typeberry/hash";
import type { MmrHasher, MmrPeaks } from "@typeberry/mmr";
import {
  BlockState,
  type LegacyBlockState,
  type LegacyRecentBlocks,
  MAX_RECENT_HISTORY,
  RecentBlocks,
} from "@typeberry/state";
import { Compatibility, GpVersion, asOpaqueType, check } from "@typeberry/utils";
import { RecentHistory, type RecentHistoryInput, type RecentHistoryState } from "./recent-history.js";
import { copyAndUpdateState } from "./test.utils.js";

const hasher: Promise<MmrHasher<KeccakHash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat: (a, b) => keccak.hashBlobs(hasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(hasher, [id, a, b]),
  };
});

const asRecentHistory = (
  arr: LegacyBlockState[] | BlockState[],
  accumulationLog?: MmrPeaks<KeccakHash>,
): RecentHistoryState => {
  check(arr.length <= MAX_RECENT_HISTORY, "Invalid size of the state input.");
  check(
    accumulationLog === undefined || Compatibility.isGreaterOrEqual(GpVersion.V0_6_7),
    "Cannot pass accumulation log to versions pre 0.6.7",
  );
  return Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
    ? {
        recentBlocks: RecentBlocks.create({
          blocks: asOpaqueType(arr as BlockState[]),
          accumulationLog: accumulationLog ?? {
            peaks: [],
          },
        }),
      }
    : {
        recentBlocks: asOpaqueType(arr as LegacyBlockState[]),
      };
};

if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
  describe("Recent History", () => {
    it("should perform a transition with empty state", async () => {
      const recentHistory = new RecentHistory(await hasher, asRecentHistory([]));
      const input: RecentHistoryInput = {
        headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
        priorStateRoot: Bytes.fill(HASH_SIZE, 2).asOpaque(),
        accumulateRoot: Bytes.fill(HASH_SIZE, 1).asOpaque(),
        workPackages: HashDictionary.new(),
      };
      const stateUpdate = recentHistory.transition(input);
      const state = copyAndUpdateState(recentHistory.state, stateUpdate);

      assert.deepStrictEqual(
        state.recentBlocks,
        RecentBlocks.create({
          blocks: asOpaqueType([
            {
              headerHash: input.headerHash,
              accumulationResult: Bytes.fill(HASH_SIZE, 1),
              postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
              reported: HashDictionary.new(),
            },
          ]),
          accumulationLog: {
            peaks: [Bytes.fill(HASH_SIZE, 1)],
          },
        }),
      );
    });

    it("should perform a transition with some state", async () => {
      const initialState = BlockState.create({
        headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
        accumulationResult: Bytes.fill(HASH_SIZE, 2),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: HashDictionary.new<WorkPackageHash, WorkPackageInfo>(),
      });
      const recentHistory = new RecentHistory(
        await hasher,
        asRecentHistory([initialState], { peaks: [Bytes.fill(HASH_SIZE, 1)] }),
      );

      const input: RecentHistoryInput = {
        headerHash: Bytes.fill(HASH_SIZE, 4).asOpaque(),
        priorStateRoot: Bytes.fill(HASH_SIZE, 5).asOpaque(),
        accumulateRoot: Bytes.fill(HASH_SIZE, 6).asOpaque(),
        workPackages: HashDictionary.fromEntries(
          [
            {
              workPackageHash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
              segmentTreeRoot: Bytes.fill(HASH_SIZE, 8).asOpaque(),
            },
          ].map((x) => [x.workPackageHash, x]),
        ),
      };
      const stateUpdate = recentHistory.transition(input);
      const state = copyAndUpdateState(recentHistory.state, stateUpdate);

      const recentBlocks = state.recentBlocks as RecentBlocks;
      assert.deepStrictEqual(recentBlocks.blocks.length, 2);
      assert.deepStrictEqual(
        recentBlocks.blocks[0],
        BlockState.create({
          headerHash: initialState.headerHash,
          accumulationResult: initialState.accumulationResult,
          postStateRoot: input.priorStateRoot,
          reported: initialState.reported,
        }),
      );
      assert.deepStrictEqual(recentBlocks.accumulationLog, {
        peaks: [
          null,
          Bytes.parseBytes("0x6ac9e94853a54beddd428600d8dd68f9c67ea0850f6d9407812a48c71e9f6958", HASH_SIZE),
        ],
      });
      assert.deepStrictEqual(recentBlocks.blocks[1], {
        headerHash: input.headerHash,
        accumulationResult: Bytes.parseBytes(
          "0x6ac9e94853a54beddd428600d8dd68f9c67ea0850f6d9407812a48c71e9f6958",
          HASH_SIZE,
        ),
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: input.workPackages,
      });
    });

    it("should only keep 8 entries", async () => {
      let input!: RecentHistoryInput;
      let state = asRecentHistory([]);

      for (let i = 0; i < 10; i++) {
        const recentHistory = new RecentHistory(await hasher, state);
        const id = (x: number) => 10 * i + x;
        input = {
          headerHash: Bytes.fill(HASH_SIZE, id(1)).asOpaque(),
          priorStateRoot: Bytes.fill(HASH_SIZE, id(2)).asOpaque(),
          accumulateRoot: Bytes.fill(HASH_SIZE, id(3)).asOpaque(),
          workPackages: HashDictionary.fromEntries(
            [
              {
                workPackageHash: Bytes.fill(HASH_SIZE, id(4)).asOpaque(),
                segmentTreeRoot: Bytes.fill(HASH_SIZE, id(5)).asOpaque(),
              },
            ].map((x) => [x.workPackageHash, x]),
          ),
        };
        const stateUpdate = recentHistory.transition(input);
        state = copyAndUpdateState(recentHistory.state, stateUpdate);
      }

      const recentBlocks = state.recentBlocks as RecentBlocks;
      assert.deepStrictEqual(recentBlocks.blocks.length, 8);
      assert.deepStrictEqual(recentBlocks.accumulationLog, {
        peaks: [
          null,
          Bytes.parseBytes("0xf2b82ebf240c42d9a13a3282f81bc914af9795b8d376fee5ffa70271ad027ef6", HASH_SIZE),
          null,
          Bytes.parseBytes("0x9db02578e7a12b19a574f27104e51df3dbcce55d37611fac0abb5da9bd0f5b97", HASH_SIZE),
        ],
      });
    });
  });
} else {
  describe("Legacy Recent History", () => {
    it("should perform a transition with empty state", async () => {
      const recentHistory = new RecentHistory(await hasher, asRecentHistory([]));
      const input: RecentHistoryInput = {
        headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
        priorStateRoot: Bytes.fill(HASH_SIZE, 2).asOpaque(),
        accumulateRoot: Bytes.fill(HASH_SIZE, 1).asOpaque(),
        workPackages: HashDictionary.new(),
      };
      const stateUpdate = recentHistory.transition(input);
      const state = copyAndUpdateState(recentHistory.state, stateUpdate);

      assert.deepStrictEqual(state.recentBlocks, [
        {
          headerHash: input.headerHash,
          mmr: {
            peaks: [Bytes.fill(HASH_SIZE, 1)],
          },
          postStateRoot: Bytes.zero(HASH_SIZE),
          reported: HashDictionary.new(),
        },
      ]);
    });

    it("should perform a transition with some state", async () => {
      const initialState = {
        headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
        mmr: {
          peaks: [Bytes.fill(HASH_SIZE, 1)],
        },
        postStateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        reported: HashDictionary.new<WorkPackageHash, WorkPackageInfo>(),
      };
      const recentHistory = new RecentHistory(await hasher, asRecentHistory([initialState]));

      const input: RecentHistoryInput = {
        headerHash: Bytes.fill(HASH_SIZE, 4).asOpaque(),
        priorStateRoot: Bytes.fill(HASH_SIZE, 5).asOpaque(),
        accumulateRoot: Bytes.fill(HASH_SIZE, 6).asOpaque(),
        workPackages: HashDictionary.fromEntries(
          [
            {
              workPackageHash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
              segmentTreeRoot: Bytes.fill(HASH_SIZE, 8).asOpaque(),
            },
          ].map((x) => [x.workPackageHash, x]),
        ),
      };
      const stateUpdate = recentHistory.transition(input);
      const state = copyAndUpdateState(recentHistory.state, stateUpdate);

      const recentBlocks = state.recentBlocks as LegacyRecentBlocks;
      assert.deepStrictEqual(recentBlocks.length, 2);
      assert.deepStrictEqual(recentBlocks[0], {
        headerHash: initialState.headerHash,
        mmr: initialState.mmr,
        // note we fill it up from the input
        postStateRoot: input.priorStateRoot,
        reported: initialState.reported,
      });
      assert.deepStrictEqual(
        recentBlocks[1].mmr.peaks[1]?.toString(),
        "0x6ac9e94853a54beddd428600d8dd68f9c67ea0850f6d9407812a48c71e9f6958",
      );
      assert.deepStrictEqual(recentBlocks[1], {
        headerHash: input.headerHash,
        mmr: {
          peaks: [
            null,
            Bytes.parseBytes("0x6ac9e94853a54beddd428600d8dd68f9c67ea0850f6d9407812a48c71e9f6958", HASH_SIZE),
          ],
        },
        postStateRoot: Bytes.zero(HASH_SIZE),
        reported: input.workPackages,
      });
    });

    it("should only keep 8 entries", async () => {
      let input!: RecentHistoryInput;
      let state = asRecentHistory([]);

      for (let i = 0; i < 10; i++) {
        const recentHistory = new RecentHistory(await hasher, state);
        const id = (x: number) => 10 * i + x;
        input = {
          headerHash: Bytes.fill(HASH_SIZE, id(1)).asOpaque(),
          priorStateRoot: Bytes.fill(HASH_SIZE, id(2)).asOpaque(),
          accumulateRoot: Bytes.fill(HASH_SIZE, id(3)).asOpaque(),
          workPackages: HashDictionary.fromEntries(
            [
              {
                workPackageHash: Bytes.fill(HASH_SIZE, id(4)).asOpaque(),
                segmentTreeRoot: Bytes.fill(HASH_SIZE, id(5)).asOpaque(),
              },
            ].map((x) => [x.workPackageHash, x]),
          ),
        };
        const stateUpdate = recentHistory.transition(input);
        state = copyAndUpdateState(recentHistory.state, stateUpdate);
      }

      const recentBlocks = state.recentBlocks as LegacyRecentBlocks;
      assert.deepStrictEqual(recentBlocks.length, 8);
      assert.deepStrictEqual(recentBlocks[7], {
        headerHash: input.headerHash,
        mmr: {
          peaks: [
            null,
            Bytes.parseBytes("0xf2b82ebf240c42d9a13a3282f81bc914af9795b8d376fee5ffa70271ad027ef6", HASH_SIZE),
            null,
            Bytes.parseBytes("0x9db02578e7a12b19a574f27104e51df3dbcce55d37611fac0abb5da9bd0f5b97", HASH_SIZE),
          ],
        },
        postStateRoot: Bytes.zero(HASH_SIZE),
        reported: input.workPackages,
      });
    });
  });
}
