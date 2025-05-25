import {
  BANDERSNATCH_KEY_BYTES,
  BANDERSNATCH_RING_ROOT_BYTES,
  BLS_KEY_BYTES,
  type BandersnatchRingRoot,
  type EntropyHash,
  type PerEpochBlock,
  type PerValidator,
  type ServiceId,
  type TimeSlot,
  type WorkReportHash,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE, type MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { Ticket } from "@typeberry/block/tickets";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/work-report";
import { Bytes } from "@typeberry/bytes";
import {
  FixedSizeArray,
  HashDictionary,
  HashSet,
  type ImmutableHashSet,
  type KnownSizeArray,
  SortedSet,
  asKnownSize,
} from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { WithDebug, assertNever, check } from "@typeberry/utils";
import type { AvailabilityAssignment } from "./assurances";
import type { BlockState } from "./block-state";
import { type PerCore, tryAsPerCore } from "./common";
import { DisputesRecords, hashComparator } from "./disputes";
import type { NotYetAccumulatedReport } from "./not-yet-accumulated";
import { PrivilegedServices } from "./privileged-services";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "./safrole-data";
import {
  LookupHistoryItem,
  type PreimageItem,
  type ServiceAccountInfo,
  type StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "./service";
import { ENTROPY_ENTRIES, type EnumerableState, type MAX_RECENT_HISTORY, type Service, type State } from "./state";
import {
  type ServicesUpdate,
  type StateUpdate,
  type UpdatePreimage,
  UpdatePreimageKind,
  type UpdateService,
  UpdateServiceKind,
  type UpdateStorage,
  UpdateStorageKind,
} from "./state-update";
import { CoreStatistics, StatisticsData, ValidatorStatistics } from "./statistics";
import { VALIDATOR_META_BYTES, ValidatorData } from "./validator-data";

/**
 * In-memory representation of the service.
 */
export class InMemoryService extends WithDebug implements Service {
  constructor(
    /** Service id. */
    readonly id: ServiceId,
    /** Service details. */
    readonly data: {
      /** https://graypaper.fluffylabs.dev/#/85129da/383303383303?v=0.6.3 */
      info: ServiceAccountInfo;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f90010f900?v=0.6.3 */
      readonly preimages: HashDictionary<PreimageHash, PreimageItem>;
      /** https://graypaper.fluffylabs.dev/#/85129da/115400115800?v=0.6.3 */
      readonly lookupHistory: HashDictionary<PreimageHash, LookupHistoryItem[]>;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f80010f800?v=0.6.3 */
      readonly storage: HashDictionary<StorageKey, StorageItem>;
    },
  ) {
    super();
  }

  info(): ServiceAccountInfo {
    return this.data.info;
  }

  storage(key: StorageKey): StorageItem | null {
    return this.data.storage.get(key) ?? null;
  }

  hasPreimage(hash: PreimageHash): boolean {
    return this.data.preimages.has(hash);
  }

  preimage(hash: PreimageHash): PreimageItem | null {
    return this.data.preimages.get(hash) ?? null;
  }

  lookupHistory(hash: PreimageHash): LookupHistoryItem[] | null {
    return this.data.lookupHistory.get(hash) ?? null;
  }
}

/**
 * A special version of state, stored fully in-memory.
 */
export class InMemoryState implements State, EnumerableState {
  /** Create a new `InMemoryState` by providing all required fields. */
  static create(state: InMemoryStateFields) {
    return new InMemoryState(state);
  }
  /**
   * Create a new `InMemoryState` with a partial state override.
   *
   * Note the rest of the state will be set to some empty,
   * not-necessarily coherent values.
   */
  static partial(spec: ChainSpec, partial: Partial<InMemoryStateFields>) {
    const state = InMemoryState.empty(spec);
    Object.assign(state, partial);
    return state;
  }

  static pickKeys<T extends Partial<InMemoryStateFields>>(self: T, other: T): T {
    const ret: Partial<T> = {};
    for (const key of Object.keys(other)) {
      const k1 = key as keyof T;
      ret[k1] = self[k1];
    }

    return ret as T;
  }

  /**
   * Modify the state and apply the state update.
   *
   * NOTE: use `updateServices` to modify the services state.
   */
  applyUpdate(update: StateUpdate<State & ServicesUpdate>) {
    const { servicesRemoved, servicesUpdates, preimages, storage, ...rest } = update;
    // just assign all other variables
    Object.assign(this, rest);
    // and update the services state
    this.updateServices(servicesUpdates);
    this.updatePreimages(preimages);
    this.updateStorage(storage);
    this.removeServices(servicesRemoved);
    return this;
  }

  private removeServices(servicesRemoved: ServiceId[] | undefined) {
    for (const serviceId of servicesRemoved ?? []) {
      check(this.services.has(serviceId), `Attempting to remove non-existing service: ${serviceId}`);
      this.services.delete(serviceId);
    }
  }

  private updateStorage(storage: UpdateStorage[] | undefined) {
    for (const { serviceId, action } of storage ?? []) {
      const { kind } = action;
      const service = this.services.get(serviceId);
      if (service === undefined) {
        throw new Error(`Attempting to update storage of non-existing service: ${serviceId}`);
      }

      if (kind === UpdateStorageKind.Set) {
        service.data.storage.set(action.storage.hash, action.storage);
      } else if (kind === UpdateStorageKind.Remove) {
        check(
          this.services.has(serviceId),
          `Attempting to remove non-existing storage item at ${serviceId}: ${action.key}`,
        );
        service.data.storage.delete(action.key);
      } else {
        assertNever(kind);
      }
    }
  }

  private updatePreimages(preimages: UpdatePreimage[] | undefined) {
    for (const { serviceId, action } of preimages ?? []) {
      const service = this.services.get(serviceId);
      if (service === undefined) {
        throw new Error(`Attempting to update preimage of non-existing service: ${serviceId}`);
      }
      const { kind } = action;
      if (kind === UpdatePreimageKind.Provide) {
        const { preimage, slot } = action;
        check(!service.data.preimages.has(preimage.hash), `Overwriting existing preimage at ${serviceId}: ${preimage}`);
        service.data.preimages.set(preimage.hash, preimage);
        if (slot !== null) {
          const lookupHistory = service.data.lookupHistory.get(preimage.hash);
          const length = tryAsU32(preimage.blob.length);
          const lookup = new LookupHistoryItem(preimage.hash, length, tryAsLookupHistorySlots([slot]));
          if (lookupHistory === undefined) {
            // no lookup history for that preimage at all (edge case, should be requested)
            service.data.lookupHistory.set(preimage.hash, [lookup]);
          } else {
            // insert or replace exiting entry
            const index = lookupHistory.map((x) => x.length).indexOf(length);
            lookupHistory.splice(index, index === -1 ? 0 : 1, lookup);
          }
        }
      } else if (kind === UpdatePreimageKind.Remove) {
        throw new Error("not implemented yet!");
      } else if (kind === UpdatePreimageKind.UpdateOrAdd) {
        throw new Error("not implemented yet!");
      } else {
        assertNever(kind);
      }
    }
  }

  private updateServices(servicesUpdates?: UpdateService[]) {
    for (const { serviceId, action } of servicesUpdates ?? []) {
      const { kind, account } = action;
      if (kind === UpdateServiceKind.Create) {
        const { lookupHistory } = action;
        this.services.set(
          serviceId,
          new InMemoryService(serviceId, {
            info: account,
            preimages: HashDictionary.new(),
            storage: HashDictionary.new(),
            lookupHistory: HashDictionary.fromEntries(
              lookupHistory === null ? [] : [[lookupHistory.hash, [lookupHistory]]],
            ),
          }),
        );
      } else if (kind === UpdateServiceKind.Update) {
        const existingService = this.services.get(serviceId);
        if (existingService === undefined) {
          throw new Error(`Attempting to update non-existing service: ${serviceId}`);
        }
        existingService.data.info = account;
      } else {
        assertNever(kind);
      }
    }
  }

  availabilityAssignment: PerCore<AvailabilityAssignment | null>;
  designatedValidatorData: PerValidator<ValidatorData>;
  nextValidatorData: PerValidator<ValidatorData>;
  currentValidatorData: PerValidator<ValidatorData>;
  previousValidatorData: PerValidator<ValidatorData>;
  disputesRecords: DisputesRecords;
  timeslot: TimeSlot;
  entropy: FixedSizeArray<EntropyHash, ENTROPY_ENTRIES>;
  authPools: PerCore<KnownSizeArray<AuthorizerHash, `At most ${typeof MAX_AUTH_POOL_SIZE}`>>;
  authQueues: PerCore<FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>>;
  recentBlocks: KnownSizeArray<BlockState, `0..${typeof MAX_RECENT_HISTORY}`>;
  statistics: StatisticsData;
  accumulationQueue: PerEpochBlock<readonly NotYetAccumulatedReport[]>;
  recentlyAccumulated: PerEpochBlock<ImmutableHashSet<WorkPackageHash>>;
  ticketsAccumulator: KnownSizeArray<Ticket, "0...EpochLength">;
  sealingKeySeries: SafroleSealingKeys;
  epochRoot: BandersnatchRingRoot;
  privilegedServices: PrivilegedServices;
  services: Map<ServiceId, InMemoryService>;

  serviceIds(): readonly ServiceId[] {
    return Array.from(this.services.keys());
  }

  service(id: ServiceId): Service | null {
    return this.services.get(id) ?? null;
  }

  private constructor(s: InMemoryStateFields) {
    this.availabilityAssignment = s.availabilityAssignment;
    this.designatedValidatorData = s.designatedValidatorData;
    this.nextValidatorData = s.nextValidatorData;
    this.currentValidatorData = s.currentValidatorData;
    this.previousValidatorData = s.previousValidatorData;
    this.disputesRecords = s.disputesRecords;
    this.timeslot = s.timeslot;
    this.entropy = s.entropy;
    this.authPools = s.authPools;
    this.authQueues = s.authQueues;
    this.recentBlocks = s.recentBlocks;
    this.statistics = s.statistics;
    this.accumulationQueue = s.accumulationQueue;
    this.recentlyAccumulated = s.recentlyAccumulated;
    this.ticketsAccumulator = s.ticketsAccumulator;
    this.sealingKeySeries = s.sealingKeySeries;
    this.epochRoot = s.epochRoot;
    this.privilegedServices = s.privilegedServices;
    this.services = s.services;
  }

  /**
   * Create an empty and possibly incoherent `InMemoryState`.
   */
  static empty(spec: ChainSpec) {
    return new InMemoryState({
      availabilityAssignment: tryAsPerCore(
        Array.from({ length: spec.coresCount }, () => null),
        spec,
      ),
      designatedValidatorData: tryAsPerValidator(
        Array.from({ length: spec.validatorsCount }, () =>
          ValidatorData.create({
            bandersnatch: Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
            ed25519: Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
          }),
        ),
        spec,
      ),
      nextValidatorData: tryAsPerValidator(
        Array.from({ length: spec.validatorsCount }, () =>
          ValidatorData.create({
            bandersnatch: Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
            ed25519: Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
          }),
        ),
        spec,
      ),
      currentValidatorData: tryAsPerValidator(
        Array.from({ length: spec.validatorsCount }, () =>
          ValidatorData.create({
            bandersnatch: Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
            ed25519: Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
          }),
        ),
        spec,
      ),
      previousValidatorData: tryAsPerValidator(
        Array.from({ length: spec.validatorsCount }, () =>
          ValidatorData.create({
            bandersnatch: Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque(),
            bls: Bytes.zero(BLS_KEY_BYTES).asOpaque(),
            ed25519: Bytes.zero(ED25519_KEY_BYTES).asOpaque(),
            metadata: Bytes.zero(VALIDATOR_META_BYTES).asOpaque(),
          }),
        ),
        spec,
      ),
      disputesRecords: DisputesRecords.create({
        goodSet: SortedSet.fromSortedArray<WorkReportHash>(hashComparator, []),
        badSet: SortedSet.fromSortedArray<WorkReportHash>(hashComparator, []),
        wonkySet: SortedSet.fromSortedArray<WorkReportHash>(hashComparator, []),
        punishSet: SortedSet.fromSortedArray<Ed25519Key>(hashComparator, []),
      }),
      timeslot: tryAsTimeSlot(0),
      entropy: FixedSizeArray.fill(() => Bytes.zero(HASH_SIZE).asOpaque(), ENTROPY_ENTRIES),
      authPools: tryAsPerCore(
        Array.from({ length: spec.coresCount }, () => asKnownSize([])),
        spec,
      ),
      authQueues: tryAsPerCore(
        Array.from({ length: spec.coresCount }, () =>
          FixedSizeArray.fill((): AuthorizerHash => Bytes.zero(HASH_SIZE).asOpaque(), AUTHORIZATION_QUEUE_SIZE),
        ),
        spec,
      ),
      recentBlocks: asKnownSize([]),
      statistics: StatisticsData.create({
        current: tryAsPerValidator(
          Array.from({ length: spec.validatorsCount }, () => ValidatorStatistics.empty()),
          spec,
        ),
        previous: tryAsPerValidator(
          Array.from({ length: spec.validatorsCount }, () => ValidatorStatistics.empty()),
          spec,
        ),
        cores: tryAsPerCore(
          Array.from({ length: spec.coresCount }, () => CoreStatistics.empty()),
          spec,
        ),
        services: new Map(),
      }),
      accumulationQueue: tryAsPerEpochBlock(
        Array.from({ length: spec.epochLength }, () => []),
        spec,
      ),
      recentlyAccumulated: tryAsPerEpochBlock(
        Array.from({ length: spec.epochLength }, () => HashSet.new()),
        spec,
      ),
      ticketsAccumulator: asKnownSize([]),
      sealingKeySeries: SafroleSealingKeysData.keys(
        tryAsPerEpochBlock(
          Array.from({ length: spec.epochLength }, () => Bytes.zero(BANDERSNATCH_KEY_BYTES).asOpaque()),
          spec,
        ),
      ),
      epochRoot: Bytes.zero(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
      privilegedServices: PrivilegedServices.create({
        manager: tryAsServiceId(0),
        authManager: tryAsServiceId(0),
        validatorsManager: tryAsServiceId(0),
        autoAccumulateServices: [],
      }),
      services: new Map(),
    });
  }
}

/** All non-function properties of the `InMemoryState`. */
export type InMemoryStateFields = Pick<InMemoryState, FieldNames<InMemoryState>>;

type FieldNames<T> = {
  // biome-ignore lint/complexity/noBannedTypes: We want only non-function fields.
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
