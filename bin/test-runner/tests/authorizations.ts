import type { CoreIndex, TimeSlot } from "@typeberry/block";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { commonFromJson } from "./common-types";

class TestCoreAuthorizer {
  static fromJson: FromJson<TestCoreAuthorizer> = {
    core: "number",
    auth_hash: commonFromJson.bytes32(),
  };

  core!: CoreIndex;
  auth_hash!: OpaqueHash;
}
class Input {
  static fromJson: FromJson<Input> = {
    slot: "number",
    auths: json.array(TestCoreAuthorizer.fromJson),
  };

  slot!: TimeSlot;
  auths!: TestCoreAuthorizer[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    auth_pools: ["array", json.array(commonFromJson.bytes32())],
    auth_queues: ["array", json.array(commonFromJson.bytes32())],
  };

  auth_pools!: OpaqueHash[][];
  auth_queues!: OpaqueHash[][];
}

export class AuthorizationsTest {
  static fromJson: FromJson<AuthorizationsTest> = {
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

export async function runAuthorizationsTest(_testContent: AuthorizationsTest) {
  // TODO [MaSi] Implement
}
