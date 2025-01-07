import type { CoreIndex, TimeSlot } from "@typeberry/block";
import { type FromJson, json } from "@typeberry/json-parser";
import { commonFromJson, getChainSpec } from "./common-types";
import {Authorization, AuthorizationInput, AuthorizationState} from "@typeberry/transition/authorization";
import {AuthorizerHash} from "@typeberry/block/work-report";
import {HashSet} from "@typeberry/collections/hash-set";

class TestCoreAuthorizer {
  static fromJson: FromJson<TestCoreAuthorizer> = {
    core: "number",
    auth_hash: commonFromJson.bytes32(),
  };

  core!: CoreIndex;
  auth_hash!: AuthorizerHash;
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

  auth_pools!: AuthorizationState['authPools'];
  auth_queues!: AuthorizationState['authQueues'];
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

export async function runAuthorizationsTest(test: AuthorizationsTest, path: string) {
  const chainSpec = getChainSpec(path);
  const state: AuthorizationState = {
    authPools: test.pre_state.auth_pools,
    authQueues: test.pre_state.auth_queues,
  };

  const input: AuthorizationInput = new Map();
  for (const { core, auth_hash } of test.input.auths) {
    const perCore = input.get(core) ?? new HashSet();
    perCore.insert(auth_hash);
    input.set(core, perCore);
  }

  const authorization = new Authorization(chainSpec, state);
  authorization.transition(input);
}
