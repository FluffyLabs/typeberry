import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { fromJson } from "@typeberry/block-json";
import { HashDictionary } from "@typeberry/collections";
import type { KeccakHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import { BlockState, type BlocksState, RecentBlocks, RecentBlocksHistory } from "@typeberry/state";

export const reportedWorkPackageFromJson = json.object<JsonReportedWorkPackageInfo, WorkPackageInfo>(
  {
    hash: fromJson.bytes32(),
    exports_root: fromJson.bytes32(),
  },
  ({ hash, exports_root }) => {
    return WorkPackageInfo.create({ workPackageHash: hash, segmentTreeRoot: exports_root });
  },
);

type JsonReportedWorkPackageInfo = {
  hash: WorkPackageHash;
  exports_root: ExportsRootHash;
};

const recentBlockStateFromJson = json.object<JsonRecentBlockState, BlockState>(
  {
    header_hash: fromJson.bytes32(),
    beefy_root: fromJson.bytes32(),
    state_root: fromJson.bytes32(),
    reported: json.array(reportedWorkPackageFromJson),
  },
  ({ header_hash, beefy_root, state_root, reported }) => {
    return BlockState.create({
      headerHash: header_hash,
      accumulationResult: beefy_root,
      postStateRoot: state_root,
      reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
    });
  },
);

type JsonRecentBlockState = {
  header_hash: HeaderHash;
  beefy_root: KeccakHash;
  state_root: StateRootHash;
  reported: WorkPackageInfo[];
};

export const recentBlocksHistoryFromJson = json.object<JsonRecentBlocks, RecentBlocksHistory>(
  {
    history: json.array(recentBlockStateFromJson),
    mmr: {
      peaks: json.array(json.nullable(fromJson.bytes32())),
    },
  },
  ({ history, mmr }) => {
    return RecentBlocksHistory.create(
      RecentBlocks.create({
        blocks: history,
        accumulationLog: mmr,
      }),
    );
  },
);

type JsonRecentBlocks = {
  history: BlocksState;
  mmr: {
    peaks: Array<KeccakHash | null>;
  };
};
