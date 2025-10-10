import {
  type EntropyHash,
  type PerEpochBlock,
  type PerValidator,
  type ServiceId,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsPerValidator,
  tryAsServiceId,
  tryAsTimeSlot,
  type WorkReportHash,
} from "@typeberry/block";
import { AUTHORIZATION_QUEUE_SIZE, type MAX_AUTH_POOL_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash, WorkPackageHash } from "@typeberry/block/refine-context.js";
import type { Ticket } from "@typeberry/block/tickets.js";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { codec } from "@typeberry/codec";
import {
  asKnownSize,
  FixedSizeArray,
  HashDictionary,
  HashSet,
  type ImmutableHashSet,
  type KnownSizeArray,
  SortedArray,
  SortedSet,
} from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { BANDERSNATCH_RING_ROOT_BYTES, type BandersnatchRingRoot } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { MAX_VALUE } from "@typeberry/pvm-interpreter/ops/math-consts.js";
import { asOpaqueType, assertNever, check, OK, Result, WithDebug } from "@typeberry/utils";
import { type AccumulationOutput, accumulationOutputComparator } from "./accumulation-output.js";
import type { AvailabilityAssignment } from "./assurances.js";
import { type PerCore, tryAsPerCore } from "./common.js";
import { DisputesRecords, hashComparator } from "./disputes.js";
import type { NotYetAccumulatedReport } from "./not-yet-accumulated.js";
import { PrivilegedServices } from "./privileged-services.js";
import { RecentBlocksHistory } from "./recent-blocks.js";
import { type SafroleSealingKeys, SafroleSealingKeysData } from "./safrole-data.js";
import {
  LookupHistoryItem,
  type LookupHistorySlots,
  PreimageItem,
  type ServiceAccountInfo,
  StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "./service.js";
import { ENTROPY_ENTRIES, type EnumerableState, type Service, type State } from "./state.js";
import {
  type ServicesUpdate,
  type UpdatePreimage,
  UpdatePreimageKind,
  type UpdateService,
  UpdateServiceKind,
  type UpdateStorage,
  UpdateStorageKind,
} from "./state-update.js";
import { CoreStatistics, StatisticsData, ValidatorStatistics } from "./statistics.js";
import { VALIDATOR_META_BYTES, ValidatorData } from "./validator-data.js";

export enum UpdateError {
  /** Attempting to create a service that already exists. */
  DuplicateService = 0,
  /** Attempting to update a non-existing service. */
  NoService = 1,
  /** Attempting to provide an existing preimage. */
  PreimageExists = 2,
}

/**
 * In-memory representation of the service.
 */
export class InMemoryService extends WithDebug implements Service {
  constructor(
    /** Service id. */
    readonly serviceId: ServiceId,
    /** Service details. */
    readonly data: {
      /** https://graypaper.fluffylabs.dev/#/85129da/383303383303?v=0.6.3 */
      info: ServiceAccountInfo;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f90010f900?v=0.6.3 */
      readonly preimages: HashDictionary<PreimageHash, PreimageItem>;
      /** https://graypaper.fluffylabs.dev/#/85129da/115400115800?v=0.6.3 */
      readonly lookupHistory: HashDictionary<PreimageHash, LookupHistoryItem[]>;
      /** https://graypaper.fluffylabs.dev/#/85129da/10f80010f800?v=0.6.3 */
      readonly storage: Map<string, StorageItem>;
    },
  ) {
    super();
  }

  getInfo(): ServiceAccountInfo {
    return this.data.info;
  }

  getStorage(rawKey: StorageKey): BytesBlob | null {
    return this.data.storage.get(rawKey.toString())?.value ?? null;
  }

  hasPreimage(hash: PreimageHash): boolean {
    return this.data.preimages.has(hash);
  }

  getPreimage(hash: PreimageHash): BytesBlob | null {
    return this.data.preimages.get(hash)?.blob ?? null;
  }

  getLookupHistory(hash: PreimageHash, len: U32): LookupHistorySlots | null {
    const item = this.data.lookupHistory.get(hash);
    if (item === undefined) {
      return null;
    }
    return item.find((x) => x.length === len)?.slots ?? null;
  }

  getEntries(): ServiceEntries {
    return {
      storageKeys: Array.from(this.data.storage.values()).map((x) => x.key),
      preimages: Array.from(this.data.preimages.keys()),
      lookupHistory: Array.from(this.data.lookupHistory.entries()).map(([hash, val]) => {
        return { hash, length: val[0].length };
      }),
    };
  }

  /**
   * Create a new in-memory service from another state service
   * by copying all given entries.
   */
  static copyFrom(service: Service, entries: ServiceEntries) {
    const info = service.getInfo();
    const preimages = HashDictionary.new<PreimageHash, PreimageItem>();
    const storage = new Map<string, StorageItem>();
    const lookupHistory = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();

    // copy preimages
    for (const hash of entries.preimages) {
      const blob = service.getPreimage(hash);
      if (blob === null) {
        throw new Error(`Service ${service.serviceId} is missing expected preimage: ${hash}`);
      }
      preimages.set(hash, PreimageItem.create({ hash, blob }));
    }

    // copy lookupHistory
    for (const { hash, length } of entries.lookupHistory) {
      const slots = service.getLookupHistory(hash, length);
      if (slots === null) {
        throw new Error(`Service ${service.serviceId} is missing expected lookupHistory: ${hash}, ${length}`);
      }
      const items = lookupHistory.get(hash) ?? [];
      items.push(new LookupHistoryItem(hash, length, slots));
      lookupHistory.set(hash, items);
    }

    // copy storage
    for (const key of entries.storageKeys) {
      const value = service.getStorage(key);
      if (value === null) {
        throw new Error(`Service ${service.serviceId} is missing expected storage: ${key}`);
      }
      storage.set(key.toString(), StorageItem.create({ key, value }));
    }

    return new InMemoryService(service.serviceId, {
      info,
      preimages,
      storage,
      lookupHistory,
    });
  }
}

/**
 * A special version of state, stored fully in-memory.
 */
export class InMemoryState extends WithDebug implements State, EnumerableState {
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

  /**
   * Create a new `InMemoryState` from some other state object.
   */
  static copyFrom(other: State, servicesData: Map<ServiceId, ServiceEntries>) {
    const services = new Map<ServiceId, InMemoryService>();
    for (const [id, entries] of servicesData.entries()) {
      const service = other.getService(id);
      if (service === null) {
        throw new Error(`Expected service ${id} to be part of the state!`);
      }
      const inMemService = InMemoryService.copyFrom(service, entries);
      services.set(id, inMemService);
    }

    return InMemoryState.create({
      availabilityAssignment: other.availabilityAssignment,
      accumulationQueue: other.accumulationQueue,
      designatedValidatorData: other.designatedValidatorData,
      nextValidatorData: other.nextValidatorData,
      currentValidatorData: other.currentValidatorData,
      previousValidatorData: other.previousValidatorData,
      disputesRecords: other.disputesRecords,
      timeslot: other.timeslot,
      entropy: other.entropy,
      authPools: other.authPools,
      authQueues: other.authQueues,
      recentBlocks: other.recentBlocks,
      statistics: other.statistics,
      recentlyAccumulated: other.recentlyAccumulated,
      ticketsAccumulator: other.ticketsAccumulator,
      sealingKeySeries: other.sealingKeySeries,
      epochRoot: other.epochRoot,
      privilegedServices: other.privilegedServices,
      accumulationOutputLog: other.accumulationOutputLog,
      services,
    });
  }

  /**
   * Convert in-memory state into enumerable service information.
   */
  intoServicesData(): Map<ServiceId, ServiceEntries> {
    const servicesData = new Map<ServiceId, ServiceEntries>();
    for (const [serviceId, { data }] of this.services) {
      servicesData.set(serviceId, {
        storageKeys: Array.from(data.storage.values()).map((x) => x.key),
        preimages: Array.from(data.preimages.keys()),
        lookupHistory: Array.from(data.lookupHistory).flatMap(([hash, items]) =>
          items.map((item) => ({ hash, length: item.length })),
        ),
      });
    }
    return servicesData;
  }

  /**
   * Modify the state and apply a single state update.
   */
  applyUpdate(update: Partial<State & ServicesUpdate>): Result<OK, UpdateError> {
    const { removed, created: _, updated, preimages, storage, ...rest } = update;
    // just assign all other variables
    Object.assign(this, rest);

    // and update the services state
    let result: Result<OK, UpdateError>;
    result = this.updateServices(updated);
    if (result.isError) {
      return result;
    }
    result = this.updatePreimages(preimages);
    if (result.isError) {
      return result;
    }
    result = this.updateStorage(storage);
    if (result.isError) {
      return result;
    }
    this.removeServices(removed);

    return Result.ok(OK);
  }

  private removeServices(servicesRemoved: ServiceId[] | undefined) {
    for (const serviceId of servicesRemoved ?? []) {
      check`${this.services.has(serviceId)} Attempting to remove non-existing service: ${serviceId}`;
      this.services.delete(serviceId);
    }
  }

  private updateStorage(storageUpdates: Map<ServiceId, UpdateStorage[]> | undefined): Result<OK, UpdateError> {
    if (storageUpdates === undefined) {
      return Result.ok(OK);
    }
    for (const [serviceId, updates] of storageUpdates.entries()) {
      for (const update of updates) {
        const { kind } = update.action;
        const service = this.services.get(serviceId);
        if (service === undefined) {
          return Result.error(
            UpdateError.NoService,
            `Attempting to update storage of non-existing service: ${serviceId}`,
          );
        }

        if (kind === UpdateStorageKind.Set) {
          const { key, value } = update.action.storage;
          service.data.storage.set(key.toString(), StorageItem.create({ key, value }));
        } else if (kind === UpdateStorageKind.Remove) {
          const { key } = update.action;
          check`
          ${service.data.storage.has(key.toString())}
          Attempting to remove non-existing storage item at ${serviceId}: ${update.action.key}
        `;
          service.data.storage.delete(key.toString());
        } else {
          assertNever(kind);
        }
      }
    }
    return Result.ok(OK);
  }

  private updatePreimages(preimagesUpdates: Map<ServiceId, UpdatePreimage[]> | undefined): Result<OK, UpdateError> {
    if (preimagesUpdates === undefined) {
      return Result.ok(OK);
    }
    for (const [serviceId, updates] of preimagesUpdates.entries()) {
      const service = this.services.get(serviceId);
      if (service === undefined) {
        return Result.error(
          UpdateError.NoService,
          `Attempting to update preimage of non-existing service: ${serviceId}`,
        );
      }
      for (const update of updates) {
        const { kind } = update.action;
        if (kind === UpdatePreimageKind.Provide) {
          const { preimage, slot } = update.action;
          if (service.data.preimages.has(preimage.hash)) {
            return Result.error(
              UpdateError.PreimageExists,
              `Overwriting existing preimage at ${serviceId}: ${preimage}`,
            );
          }
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
          const { hash, length } = update.action;
          service.data.preimages.delete(hash);
          const history = service.data.lookupHistory.get(hash) ?? [];
          const idx = history.map((x) => x.length).indexOf(length);
          if (idx !== -1) {
            history.splice(idx, 1);
          }
        } else if (kind === UpdatePreimageKind.UpdateOrAdd) {
          const { item } = update.action;
          const history = service.data.lookupHistory.get(item.hash) ?? [];
          const existingIdx = history.map((x) => x.length).indexOf(item.length);
          const removeCount = existingIdx === -1 ? 0 : 1;
          history.splice(existingIdx, removeCount, item);
          service.data.lookupHistory.set(item.hash, history);
        } else {
          assertNever(kind);
        }
      }
    }
    return Result.ok(OK);
  }

  private updateServices(servicesUpdates: Map<ServiceId, UpdateService> | undefined): Result<OK, UpdateError> {
    if (servicesUpdates === undefined) {
      return Result.ok(OK);
    }
    for (const [serviceId, update] of servicesUpdates.entries()) {
      const { kind, account } = update.action;
      if (kind === UpdateServiceKind.Create) {
        const { lookupHistory } = update.action;
        if (this.services.has(serviceId)) {
          return Result.error(UpdateError.DuplicateService, `${serviceId} already exists!`);
        }
        this.services.set(
          serviceId,
          new InMemoryService(serviceId, {
            info: account,
            preimages: HashDictionary.new(),
            storage: new Map(),
            lookupHistory: HashDictionary.fromEntries(
              lookupHistory === null ? [] : [[lookupHistory.hash, [lookupHistory]]],
            ),
          }),
        );
      } else if (kind === UpdateServiceKind.Update) {
        const existingService = this.services.get(serviceId);
        if (existingService === undefined) {
          return Result.error(UpdateError.NoService, `Cannot update ${serviceId} because it does not exist.`);
        }
        existingService.data.info = account;
      } else {
        assertNever(kind);
      }
    }
    return Result.ok(OK);
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
  recentBlocks: RecentBlocksHistory;
  statistics: StatisticsData;
  accumulationQueue: PerEpochBlock<readonly NotYetAccumulatedReport[]>;
  recentlyAccumulated: PerEpochBlock<ImmutableHashSet<WorkPackageHash>>;
  ticketsAccumulator: KnownSizeArray<Ticket, "0...EpochLength">;
  sealingKeySeries: SafroleSealingKeys;
  epochRoot: BandersnatchRingRoot;
  privilegedServices: PrivilegedServices;
  accumulationOutputLog: SortedArray<AccumulationOutput>;
  services: Map<ServiceId, InMemoryService>;

  recentServiceIds(): readonly ServiceId[] {
    return Array.from(this.services.keys());
  }

  getService(id: ServiceId): Service | null {
    return this.services.get(id) ?? null;
  }

  private constructor(s: InMemoryStateFields) {
    super();
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
    this.accumulationOutputLog = s.accumulationOutputLog;
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
      recentBlocks: RecentBlocksHistory.empty(),
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
        assigners: tryAsPerCore(new Array(spec.coresCount).fill(tryAsServiceId(0)), spec),
        delegator: tryAsServiceId(0),
        registrar: tryAsServiceId(MAX_VALUE),
        autoAccumulateServices: [],
      }),
      accumulationOutputLog: SortedArray.fromArray(accumulationOutputComparator, []),
      services: new Map(),
    });
  }
}

/** Enumeration of all service-related data. */
export type ServiceEntries = {
  /** Service storage keys. */
  storageKeys: StorageKey[];
  /** Service preimages. */
  preimages: PreimageHash[];
  /** Service lookup history. */
  lookupHistory: { hash: PreimageHash; length: U32 }[];
};

export const serviceEntriesCodec = codec.object<ServiceEntries>({
  storageKeys: codec.sequenceVarLen(
    codec.blob.convert(
      (i) => i,
      (o) => asOpaqueType(o),
    ),
  ),
  preimages: codec.sequenceVarLen(codec.bytes(HASH_SIZE).asOpaque<PreimageHash>()),
  lookupHistory: codec.sequenceVarLen(
    codec.object({
      hash: codec.bytes(HASH_SIZE).asOpaque<PreimageHash>(),
      length: codec.u32,
    }),
  ),
});

/** Enumeration of all services and it's internall data. */
export type ServiceData = Map<ServiceId, ServiceEntries>;

export const serviceDataCodec = codec.dictionary(codec.u32.asOpaque<ServiceId>(), serviceEntriesCodec, {
  sortKeys: (a, b) => a - b,
});

/** All non-function properties of the `InMemoryState`. */
export type InMemoryStateFields = Pick<InMemoryState, FieldNames<InMemoryState>>;

type FieldNames<T> = {
  // biome-ignore lint/complexity/noBannedTypes: We want only non-function fields.
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];
