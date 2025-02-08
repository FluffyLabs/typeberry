import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { type KeccakHash, type OpaqueHash, keccak } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { MmrHasher } from "@typeberry/mmr";
import {
  type BlockState,
  RecentHistory,
  type RecentHistoryInput,
  type RecentHistoryState,
  type WorkPackageInfo,
} from "@typeberry/transition/recent-history";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { TestBlockState, TestWorkPackageInfo, commonFromJson } from "./common-types";

class Input {
  static fromJson = json.object<Input, RecentHistoryInput>(
    {
      header_hash: commonFromJson.bytes32(),
      parent_state_root: commonFromJson.bytes32(),
      accumulate_root: commonFromJson.bytes32(),
      work_packages: json.array(TestWorkPackageInfo.fromJson),
    },
    ({ header_hash, parent_state_root, accumulate_root, work_packages }) => {
      return {
        headerHash: header_hash,
        priorStateRoot: parent_state_root,
        accumulateRoot: accumulate_root,
        workPackages: work_packages,
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
      beta: json.array(TestBlockState.fromJson),
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
  recentHistory.transition(testContent.input);

  deepEqual(recentHistory.state, testContent.post_state);
}
