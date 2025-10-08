import type { ServiceId } from "@typeberry/block";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type CodecWithView, Decoder, type SequenceView } from "@typeberry/codec";
import type { HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type {
  AccumulationQueueView,
  AuthorizationPool,
  AuthorizationQueue,
  AvailabilityAssignmentsView,
  RecentBlocksView,
  RecentlyAccumulatedView,
  SafroleDataView,
  ServiceAccountInfoView,
  StatisticsDataView,
  ValidatorData,
  ValidatorDataView,
} from "@typeberry/state";
import type { StateView } from "@typeberry/state/state-view.js";
import type { StateKey } from "./keys.js";
import { serialize } from "./serialize.js";

/**
 * Abstraction over some backend containing serialized state entries.
 *
 * This may or may not be backed by some on-disk database or can be just stored in memory.
 */
export interface SerializedStateBackend {
  /** Retrieve given state key. */
  get(key: StateKey): BytesBlob | null;
}

export class SerializedStateView<T extends SerializedStateBackend> implements StateView {
  constructor(
    private readonly spec: ChainSpec,
    public backend: T,
    /** Best-effort list of recently active services. */
    private readonly _recentServiceIds: ServiceId[],
    private readonly viewCache: HashDictionary<StateKey, unknown>,
  ) {}

  private retrieveView<A, B>({ key, Codec }: KeyAndCodecWithView<A, B>, description: string): B {
    const cached = this.viewCache.get(key);
    if (cached !== undefined) {
      return cached as B;
    }
    const bytes = this.backend.get(key);
    if (bytes === null) {
      throw new Error(`Required state entry for ${description} is missing!. Accessing view of key: ${key}`);
    }
    // NOTE [ToDr] we are not using `Decoder.decodeObject` here because
    // it needs to get to the end of the data (skip), yet that's expensive.
    // we assume that the state data is correct and coherent anyway, so
    // for performance reasons we simply create the view here.
    const d = Decoder.fromBytesBlob(bytes);
    d.attachContext(this.spec);
    const view = Codec.View.decode(d);
    this.viewCache.set(key, view);
    return view;
  }

  availabilityAssignmentView(): AvailabilityAssignmentsView {
    return this.retrieveView(serialize.availabilityAssignment, "availabilityAssignmentView");
  }

  designatedValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return this.retrieveView(serialize.designatedValidators, "designatedValidatorsView");
  }

  currentValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return this.retrieveView(serialize.currentValidators, "currentValidatorsView");
  }

  previousValidatorDataView(): SequenceView<ValidatorData, ValidatorDataView> {
    return this.retrieveView(serialize.previousValidators, "previousValidatorsView");
  }

  authPoolsView(): SequenceView<AuthorizationPool, SequenceView<AuthorizerHash>> {
    return this.retrieveView(serialize.authPools, "authPoolsView");
  }

  authQueuesView(): SequenceView<AuthorizationQueue, SequenceView<AuthorizerHash>> {
    return this.retrieveView(serialize.authQueues, "authQueuesView");
  }

  recentBlocksView(): RecentBlocksView {
    return this.retrieveView(serialize.recentBlocks, "recentBlocksView");
  }

  statisticsView(): StatisticsDataView {
    return this.retrieveView(serialize.statistics, "statisticsView");
  }

  accumulationQueueView(): AccumulationQueueView {
    return this.retrieveView(serialize.accumulationQueue, "accumulationQueueView");
  }

  recentlyAccumulatedView(): RecentlyAccumulatedView {
    return this.retrieveView(serialize.recentlyAccumulated, "recentlyAccumulatedView");
  }

  safroleDataView(): SafroleDataView {
    return this.retrieveView(serialize.safrole, "safroleDataView");
  }

  getServiceInfoView(id: ServiceId): ServiceAccountInfoView | null {
    const serviceData = serialize.serviceData(id);
    const bytes = this.backend.get(serviceData.key);
    if (bytes === null) {
      return null;
    }
    if (!this._recentServiceIds.includes(id)) {
      this._recentServiceIds.push(id);
    }
    return Decoder.decodeObject(serviceData.Codec.View, bytes, this.spec);
  }
}

type KeyAndCodecWithView<T, V> = {
  key: StateKey;
  Codec: CodecWithView<T, V>;
};
