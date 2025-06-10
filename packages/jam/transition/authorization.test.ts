import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set.js";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsPerCore } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { Authorization, type AuthorizationInput, type AuthorizationState } from "./authorization.js";
import {copyAndUpdateState} from "./test.utils.js";

const authQueues = (core1: AuthorizerHash[], core2: AuthorizerHash[]): AuthorizationState["authQueues"] => {
  return tryAsPerCore([asKnownSize(core1), asKnownSize(core2)], tinyChainSpec);
};
const authPools = (core1: AuthorizerHash[], core2: AuthorizerHash[]): AuthorizationState["authPools"] => {
  return tryAsPerCore([asKnownSize(core1), asKnownSize(core2)], tinyChainSpec);
};

const h = (n: number): AuthorizerHash => Bytes.fill(HASH_SIZE, n).asOpaque();

const used = (...data: [number, AuthorizerHash][]) => {
  const used = new Map();
  for (const [core, hash] of data) {
    const perCore = used.get(core) ?? HashSet.new();
    perCore.insert(hash);
    used.set(core, perCore);
  }
  return used;
};

describe("Authorization", () => {
  it("should perform a transition with empty state", async () => {
    const authorization = new Authorization(tinyChainSpec, {
      authPools: authPools([], []),
      authQueues: authQueues([h(1)], [h(1)]),
    });

    const input: AuthorizationInput = {
      slot: tryAsTimeSlot(0),
      used: used(),
    };
    const stateUpdate = authorization.transition(input);
    const state = copyAndUpdateState(authorization.state, stateUpdate);

    deepEqual(state.authPools, authPools([h(1)], [h(1)]), { context: "pools" });
    deepEqual(state.authQueues, authQueues([h(1)], [h(1)]), { context: "queues" });
  });

  it("should perform a transition and remove existing entries", async () => {
    const authorization = new Authorization(tinyChainSpec, {
      authPools: authPools([h(0), h(0)], [h(2), h(3), h(2)]),
      authQueues: authQueues([h(1)], [h(1)]),
    });

    const input: AuthorizationInput = {
      slot: tryAsTimeSlot(0),
      used: used([0, h(1)], [1, h(2)]),
    };
    const stateUpdate = authorization.transition(input);
    const state = copyAndUpdateState(authorization.state, stateUpdate);

    deepEqual(state.authPools, authPools([h(0), h(0), h(1)], [h(3), h(2), h(1)]), { context: "pools" });
    deepEqual(state.authQueues, authQueues([h(1)], [h(1)]), { context: "queues" });
  });

  it("should perform a transition and keep last items in pool", async () => {
    const authorization = new Authorization(tinyChainSpec, {
      authPools: authPools(
        Array(MAX_AUTH_POOL_SIZE + 1)
          .fill(0)
          .map((_, idx) => h(idx)),
        [h(2), h(3), h(2)],
      ),
      authQueues: authQueues([h(10), h(11)], [h(1), h(2)]),
    });

    const input: AuthorizationInput = {
      slot: tryAsTimeSlot(1),
      used: used([0, h(13)], [1, h(2)]),
    };
    const stateUpdate = authorization.transition(input);
    const state = copyAndUpdateState(authorization.state, stateUpdate);

    deepEqual(state.authPools, authPools([h(2), h(3), h(4), h(5), h(6), h(7), h(8), h(11)], [h(3), h(2), h(2)]), {
      context: "pools",
    });
    deepEqual(state.authQueues, authQueues([h(10), h(11)], [h(1), h(2)]), { context: "queues" });
  });
});
