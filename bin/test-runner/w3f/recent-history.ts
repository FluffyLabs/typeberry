import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { WorkPackageInfo } from "@typeberry/block/work-report.js";
import { HashDictionary } from "@typeberry/collections";
import { type KeccakHash, type OpaqueHash, keccak } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { MmrHasher } from "@typeberry/mmr";
import type { BlockState } from "@typeberry/state";
import { blockStateFromJson, reportedWorkPackageFromJson } from "@typeberry/state-json";
import {
  RecentHistory,
  type RecentHistoryInput,
  type RecentHistoryState,
} from "@typeberry/transition/recent-history.js";
import { copyAndUpdateState } from "@typeberry/transition/test.utils.js";
import { asOpaqueType, deepEqual } from "@typeberry/utils";

class Input {
  static fromJson = json.object<Input, RecentHistoryInput>(
    {
      header_hash: fromJson.bytes32(),
      parent_state_root: fromJson.bytes32(),
      accumulate_root: fromJson.bytes32(),
      work_packages: json.array(reportedWorkPackageFromJson),
    },
    ({ header_hash, parent_state_root, accumulate_root, work_packages }) => {
      return {
        headerHash: header_hash,
        priorStateRoot: parent_state_root,
        accumulateRoot: accumulate_root,
        workPackages: HashDictionary.fromEntries(work_packages.map((x) => [x.workPackageHash, x])),
      };
    },
  );

  header_hash!: HeaderHash;
  parent_state_root!: StateRootHash;
  accumulate_root!: OpaqueHash;
  work_packages!: WorkPackageInfo[];
}

class TestState {
  static fromJson = json.object<TestState, RecentHistoryState>(
    {
      beta: json.array(blockStateFromJson),
    },
    ({ beta }) => ({
      recentBlocks: asOpaqueType(beta),
    }),
  );

  beta!: BlockState[];
}

export class HistoryTest {
  static fromJson: FromJson<HistoryTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: json.fromAny(() => null),
    post_state: TestState.fromJson,
  };

  input!: RecentHistoryInput;
  pre_state!: RecentHistoryState;
  output!: null;
  post_state!: RecentHistoryState;
}

export async function runHistoryTest(testContent: HistoryTest) {
  const keccakHasher = await keccak.KeccakHasher.create();
  const hasher: MmrHasher<KeccakHash> = {
    hashConcat: (a, b) => keccak.hashBlobs(keccakHasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(keccakHasher, [id, a, b]),
  };

  const recentHistory = new RecentHistory(hasher, testContent.pre_state);
  const stateUpdate = recentHistory.transition(testContent.input);
  const result = copyAndUpdateState(recentHistory.state, stateUpdate);

  deepEqual(result, testContent.post_state);
}
