import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { HashDictionary } from "@typeberry/collections";
import type { KeccakHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import {
  BlockState,
  type BlocksState,
  type LegacyBlockState,
  type LegacyBlocksState,
  LegacyRecentBlocks,
  RecentBlocks,
  RecentBlocksHistory,
} from "@typeberry/state";
import { Compatibility, GpVersion } from "@typeberry/utils";

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

const recentBlocksFromJson = json.object<JsonRecentBlocks, RecentBlocksHistory>(
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

const legacyRecentBlockStateFromJson = json.object<JsonRecentBlockStateLegacy, LegacyBlockState>(
  {
    header_hash: fromJson.bytes32(),
    mmr: {
      peaks: json.array(json.nullable(fromJson.bytes32())),
    },
    state_root: fromJson.bytes32(),
    reported: json.array(reportedWorkPackageFromJson),
  },
  ({ header_hash, mmr, state_root, reported }) => {
    return {
      headerHash: header_hash,
      mmr,
      postStateRoot: state_root,
      reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
    };
  },
);

type JsonRecentBlockStateLegacy = {
  header_hash: HeaderHash;
  mmr: {
    peaks: Array<KeccakHash | null>;
  };
  state_root: StateRootHash;
  reported: WorkPackageInfo[];
};

const legacyRecentBlocksFromJson = json.object<LegacyBlocksState, RecentBlocksHistory>(
  json.array(legacyRecentBlockStateFromJson),
  (blocks) => {
    return RecentBlocksHistory.legacyCreate(
      LegacyRecentBlocks.create({
        blocks,
      }),
    );
  },
);

export const recentBlocksHistoryFromJson = Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)
  ? recentBlocksFromJson
  : legacyRecentBlocksFromJson;
