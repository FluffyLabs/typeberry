import assert from "node:assert";

import type { HeaderHash, StateRootHash } from "@typeberry/block";
import { type KeccakHash, type OpaqueHash, keccak } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { MmrHasher } from "@typeberry/mmr";
import { RecentHistory, type RecentHistoryInput, type RecentHistoryState } from "@typeberry/transition/recent-history";
import { inspect } from "@typeberry/utils";
import { TestBlocksInfo, TestReportedWorkPackage, commonFromJson } from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    header_hash: commonFromJson.bytes32(),
    parent_state_root: commonFromJson.bytes32(),
    accumulate_root: commonFromJson.bytes32(),
    work_packages: json.array(TestReportedWorkPackage.fromJson),
  };

  header_hash!: HeaderHash;
  parent_state_root!: StateRootHash;
  accumulate_root!: OpaqueHash;
  work_packages!: TestReportedWorkPackage[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    beta: json.array(TestBlocksInfo.fromJson),
  };

  beta!: TestBlocksInfo[];
}

export class HistoryTest {
  static fromJson: FromJson<HistoryTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: json.fromAny(() => null),
    post_state: TestState.fromJson,
  };

  input!: Input;
  pre_state!: TestState;
  output!: null;
  post_state!: TestState;
}

export async function runHistoryTest(testContent: HistoryTest) {
  const keccakHasher = await keccak.KeccakHasher.create();
  const hasher: MmrHasher<KeccakHash> = {
    hashConcat: (a, b) => keccak.hashBlobs(keccakHasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(keccakHasher, [id, a, b]),
  };

  const state = convertState(testContent.pre_state);

  const input: RecentHistoryInput = {
    headerHash: testContent.input.header_hash,
    priorStateRoot: testContent.input.parent_state_root,
    accumulateRoot: testContent.input.accumulate_root,
    workPackages: testContent.input.work_packages.map((p) => ({
      hash: p.hash,
      exportsRoot: p.exports_root,
    })),
  };
  const recentHistory = new RecentHistory(hasher, state);
  recentHistory.transition(input);

  assert.deepEqual(inspect(recentHistory.state), inspect(convertState(testContent.post_state)));
}

function convertState(state: TestState): RecentHistoryState {
  return state.beta.map((x) => ({
    headerHash: x.header_hash,
    mmr: x.mmr,
    postStateRoot: x.state_root,
    reported: x.reported.map((r) => ({
      hash: r.hash,
      exportsRoot: r.exports_root,
    })),
  }));
}
