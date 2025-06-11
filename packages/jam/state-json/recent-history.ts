import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { HashDictionary } from "@typeberry/collections";
import type { KeccakHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import type { BlockState } from "@typeberry/state";

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

export const blockStateFromJson = json.object<JsonBlockState, BlockState>(
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

type JsonBlockState = {
  header_hash: HeaderHash;
  mmr: {
    peaks: Array<KeccakHash | null>;
  };
  state_root: StateRootHash;
  reported: WorkPackageInfo[];
};
