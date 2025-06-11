import type { CoreIndex, TimeSlot } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { HashSet } from "@typeberry/collections/hash-set.js";
import { type FromJson, json } from "@typeberry/json-parser";
import {
  Authorization,
  type AuthorizationInput,
  type AuthorizationState,
} from "@typeberry/transition/authorization.js";
import { copyAndUpdateState } from "@typeberry/transition/test.utils.js";
import { deepEqual } from "@typeberry/utils";
import { getChainSpec } from "./spec.js";

class TestCoreAuthorizer {
  static fromJson: FromJson<TestCoreAuthorizer> = {
    core: "number",
    auth_hash: fromJson.bytes32(),
  };

  core!: CoreIndex;
  auth_hash!: AuthorizerHash;
}
class Input {
  static fromJson = json.object<Input, AuthorizationInput>(
    {
      slot: "number",
      auths: json.array(TestCoreAuthorizer.fromJson),
    },
    ({ slot, auths }) => {
      const input: AuthorizationInput = {
        slot,
        used: new Map(),
      };
      for (const { core, auth_hash } of auths) {
        const perCore = input.used.get(core) ?? HashSet.new();
        perCore.insert(auth_hash);
        input.used.set(core, perCore);
      }
      return input;
    },
  );

  slot!: TimeSlot;
  auths!: TestCoreAuthorizer[];
}

class TestState {
  static fromJson = json.object<TestState, AuthorizationState>(
    {
      auth_pools: ["array", json.array(fromJson.bytes32())],
      auth_queues: ["array", json.array(fromJson.bytes32())],
    },
    ({ auth_pools, auth_queues }) => {
      return {
        authPools: auth_pools,
        authQueues: auth_queues,
      };
    },
  );

  auth_pools!: AuthorizationState["authPools"];
  auth_queues!: AuthorizationState["authQueues"];
}

export class AuthorizationsTest {
  static fromJson: FromJson<AuthorizationsTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: json.fromAny(() => null),
    post_state: TestState.fromJson,
  };

  input!: AuthorizationInput;
  pre_state!: AuthorizationState;
  output!: null;
  post_state!: AuthorizationState;
}

export async function runAuthorizationsTest(test: AuthorizationsTest, path: string) {
  const chainSpec = getChainSpec(path);

  const authorization = new Authorization(chainSpec, test.pre_state);
  const update = authorization.transition(test.input);
  const result = copyAndUpdateState(test.pre_state, update);

  deepEqual(result, test.post_state);
}
