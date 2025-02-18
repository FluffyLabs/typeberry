import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE, type KeccakHash, keccak } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import { type BlockState, MAX_RECENT_HISTORY } from "@typeberry/state";
import { asOpaqueType, check } from "@typeberry/utils";
import { RecentHistory, type RecentHistoryInput, type RecentHistoryState } from "./recent-history";

const hasher: Promise<MmrHasher<KeccakHash>> = keccak.KeccakHasher.create().then((hasher) => {
  return {
    hashConcat: (a, b) => keccak.hashBlobs(hasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(hasher, [id, a, b]),
  };
});

const asRecentHistory = (arr: BlockState[]): RecentHistoryState => {
  check(arr.length <= MAX_RECENT_HISTORY, "Invalid size of the state input.");
  return {
    recentBlocks: asOpaqueType(arr),
  };
};

describe("Recent History", () => {
  it("should perform a transition with empty state", async () => {
    const recentHistory = new RecentHistory(await hasher, asRecentHistory([]));
    const input: RecentHistoryInput = {
      headerHash: Bytes.fill(HASH_SIZE, 3).asOpaque(),
      priorStateRoot: Bytes.fill(HASH_SIZE, 2).asOpaque(),
      accumulateRoot: Bytes.fill(HASH_SIZE, 1).asOpaque(),
      workPackages: [],
    };
    recentHistory.transition(input);

    assert.deepStrictEqual(recentHistory.state.recentBlocks, [
      {
        headerHash: input.headerHash,
        mmr: {
          peaks: [Bytes.fill(HASH_SIZE, 1)],
        },
        postStateRoot: Bytes.zero(HASH_SIZE),
        reported: [],
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
      reported: [],
    };
    const recentHistory = new RecentHistory(await hasher, asRecentHistory([initialState]));

    const input: RecentHistoryInput = {
      headerHash: Bytes.fill(HASH_SIZE, 4).asOpaque(),
      priorStateRoot: Bytes.fill(HASH_SIZE, 5).asOpaque(),
      accumulateRoot: Bytes.fill(HASH_SIZE, 6).asOpaque(),
      workPackages: [
        {
          hash: Bytes.fill(HASH_SIZE, 7).asOpaque(),
          exportsRoot: Bytes.fill(HASH_SIZE, 8).asOpaque(),
        },
      ],
    };
    recentHistory.transition(input);

    const recentBlocks = recentHistory.state.recentBlocks;
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
    const recentHistory = new RecentHistory(await hasher, asRecentHistory([]));

    let input!: RecentHistoryInput;
    for (let i = 0; i < 10; i++) {
      const id = (x: number) => 10 * i + x;
      input = {
        headerHash: Bytes.fill(HASH_SIZE, id(1)).asOpaque(),
        priorStateRoot: Bytes.fill(HASH_SIZE, id(2)).asOpaque(),
        accumulateRoot: Bytes.fill(HASH_SIZE, id(3)).asOpaque(),
        workPackages: [
          {
            hash: Bytes.fill(HASH_SIZE, id(4)).asOpaque(),
            exportsRoot: Bytes.fill(HASH_SIZE, id(5)).asOpaque(),
          },
        ],
      };
      recentHistory.transition(input);
    }

    const recentBlocks = recentHistory.state.recentBlocks;
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
