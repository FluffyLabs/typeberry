import { reencodeAsView, type ServiceId } from "@typeberry/block";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { SequenceView } from "@typeberry/codec";
import { type AccumulationQueueView, accumulationQueueCodec } from "./accumulation-queue.js";
import { type AvailabilityAssignmentsView, availabilityAssignmentsCodec } from "./assurances.js";
import { type AuthorizationPool, type AuthorizationQueue, authPoolsCodec, authQueuesCodec } from "./auth.js";
import { RecentBlocks, type RecentBlocksView } from "./recent-blocks.js";
import { type RecentlyAccumulatedView, recentlyAccumulatedCodec } from "./recently-accumulated.js";
import { SafroleData, type SafroleDataView } from "./safrole-data.js";
import { ServiceAccountInfo, type ServiceAccountInfoView } from "./service.js";
import type { State } from "./state.js";
import type { StateView } from "./state-view.js";
import { StatisticsData, type StatisticsDataView } from "./statistics.js";
import { type ValidatorData, type ValidatorDataView, validatorsDataCodec } from "./validator-data.js";

export class InMemoryStateView implements StateView {
  constructor(private readonly state: State) {}

  availabilityAssignmentView(): AvailabilityAssignmentsView {
    return reencodeAsView(availabilityAssignmentsCodec, this.state.availabilityAssignment);
  }

  designatedValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return reencodeAsView(validatorsDataCodec, this.state.designatedValidatorData);
  }

  currentValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return reencodeAsView(validatorsDataCodec, this.state.currentValidatorData);
  }

  previousValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return reencodeAsView(validatorsDataCodec, this.state.previousValidatorData);
  }

  authPoolsView(): SequenceView<AuthorizationPool, SequenceView<AuthorizerHash>> {
    return reencodeAsView(authPoolsCodec, this.state.authPools);
  }

  authQueuesView(): SequenceView<AuthorizationQueue, SequenceView<AuthorizerHash>> {
    return reencodeAsView(authQueuesCodec, this.state.authQueues);
  }

  recentBlocksView(): RecentBlocksView {
    return reencodeAsView(RecentBlocks.Codec, this.state.recentBlocks);
  }

  statisticsView(): StatisticsDataView {
    return reencodeAsView(StatisticsData.Codec, this.state.statistics);
  }

  accumulationQueueView(): AccumulationQueueView {
    return reencodeAsView(accumulationQueueCodec, this.state.accumulationQueue);
  }

  recentlyAccumulatedView(): RecentlyAccumulatedView {
    return reencodeAsView(recentlyAccumulatedCodec, this.state.recentlyAccumulated);
  }

  safroleDataView(): SafroleDataView {
    // TODO [ToDr] Consider exposting `safrole` from state
    // instead of individual fields
    const safrole = SafroleData.create({
      nextValidatorData: this.state.nextValidatorData,
      epochRoot: this.state.epochRoot,
      sealingKeySeries: this.state.sealingKeySeries,
      ticketsAccumulator: this.state.ticketsAccumulator,
    });
    return reencodeAsView(SafroleData.Codec, safrole);
  }

  getServiceInfoView(id: ServiceId): ServiceAccountInfoView | null {
    const service = this.state.getService(id);
    if (service === null) {
      return null;
    }

    return reencodeAsView(ServiceAccountInfo.Codec, service.getInfo());
  }
}
