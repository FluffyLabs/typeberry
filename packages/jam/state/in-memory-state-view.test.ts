import { describe, it } from "node:test";
import type { BytesBlob } from "@typeberry/bytes";
import { type Encode, Encoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { deepEqual } from "@typeberry/utils";
import { accumulationQueueCodec } from "./accumulation-queue.js";
import { availabilityAssignmentsCodec } from "./assurances.js";
import { authPoolsCodec, authQueuesCodec } from "./auth.js";
import { recentlyAccumulatedCodec } from "./recently-accumulated.js";
import { SafroleData } from "./safrole-data.js";
import { testState } from "./test.utils.js";
import { validatorsDataCodec } from "./validator-data.js";

const encode = <T>(codec: Encode<T>, val: T): BytesBlob => {
  return Encoder.encodeObject(codec, val, tinyChainSpec);
};

describe("InMemoryStateView", () => {
  it("should match encoded state", () => {
    const state = testState();
    const view = state.view();
    const serviceId = state.services.keys().next().value;
    if (serviceId === undefined) {
      throw new Error("missing service!");
    }

    deepEqual(view.accumulationQueueView().encoded(), encode(accumulationQueueCodec, state.accumulationQueue));
    deepEqual(view.authPoolsView().encoded(), encode(authPoolsCodec, state.authPools));
    deepEqual(view.authQueuesView().encoded(), encode(authQueuesCodec, state.authQueues));
    deepEqual(
      view.availabilityAssignmentView().encoded(),
      encode(availabilityAssignmentsCodec, state.availabilityAssignment),
    );
    deepEqual(view.currentValidatorDataView().encoded(), encode(validatorsDataCodec, state.currentValidatorData));
    deepEqual(view.designatedValidatorDataView().encoded(), encode(validatorsDataCodec, state.designatedValidatorData));
    deepEqual(view.getServiceInfoView(serviceId)?.materialize(), state.getService(serviceId)?.getInfo());
    deepEqual(view.previousValidatorDataView().encoded(), encode(validatorsDataCodec, state.previousValidatorData));
    deepEqual(view.recentBlocksView().materialize(), state.recentBlocks);
    deepEqual(view.recentlyAccumulatedView().encoded(), encode(recentlyAccumulatedCodec, state.recentlyAccumulated));

    deepEqual(
      view.safroleDataView().materialize(),
      SafroleData.create({
        nextValidatorData: state.nextValidatorData,
        epochRoot: state.epochRoot,
        sealingKeySeries: state.sealingKeySeries,
        ticketsAccumulator: state.ticketsAccumulator,
      }),
    );
    deepEqual(view.statisticsView().materialize(), state.statistics);
  });
});
