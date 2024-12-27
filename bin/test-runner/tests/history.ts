import type { HeaderHash } from "@typeberry/block";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { TestBlocksInfo, TestReportedWorkPackage, commonFromJson } from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    header_hash: commonFromJson.bytes32(),
    parent_state_root: commonFromJson.bytes32(),
    accumulate_root: commonFromJson.bytes32(),
    work_packages: json.array(TestReportedWorkPackage.fromJson),
  };

  header_hash!: HeaderHash;
  parent_state_root!: OpaqueHash;
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

export async function runHistoryTest(_testContent: HistoryTest) {
  // TODO [MaSi] Implement
}
