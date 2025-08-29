import { type ServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type Decode, Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { blake2b } from "@typeberry/hash";
import { type U32, u32AsLeBytes } from "@typeberry/numbers";
import {
  type EnumerableState,
  type LookupHistorySlots,
  type Service,
  type ServiceAccountInfo,
  type State,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { Compatibility, GpVersion, TEST_COMPARE_USING } from "@typeberry/utils";
import type { StateKey } from "./keys.js";
import { serialize } from "./serialize.js";
import type { StateEntries } from "./state-entries.js";

const SERVICE_ID_BYTES = 4;

/**
 * Abstraction over some backend containing serialized state entries.
 *
 * This may or may not be backed by some on-disk database or can be just stored in memory.
 */
export interface SerializedStateBackend {
  /** Retrieve given state key. */
  get(key: StateKey): BytesBlob | null;
}

/**
 * State object which reads it's entries from some backend.
 *
 * It differs from `InMemoryState` by needing to serialize the keys before accessing them.
 *
 * NOTE: the object has no way of knowing if all of the required data is present
 * in the backend layer, so it MAY fail during runtime.
 */
export class SerializedState<T extends SerializedStateBackend = SerializedStateBackend>
  implements State, EnumerableState
{
  /** Create a state-like object from collection of serialized entries. */
  static fromStateEntries(spec: ChainSpec, state: StateEntries, recentServices: ServiceId[] = []) {
    return new SerializedState(spec, state, recentServices);
  }

  /** Create a state-like object backed by some DB. */
  static new<T extends SerializedStateBackend>(
    spec: ChainSpec,
    db: T,
    recentServices: ServiceId[] = [],
  ): SerializedState<T> {
    return new SerializedState(spec, db, recentServices);
  }

  private constructor(
    private readonly spec: ChainSpec,
    public backend: T,
    /** Best-effort list of recently active services. */
    private readonly _recentServiceIds: ServiceId[],
  ) {}

  /** Comparing the serialized states, just means comparing their backends. */
  [TEST_COMPARE_USING]() {
    return this.backend;
  }

  // TODO [ToDr] Temporary method to update the state,
  // without changing references.
  public updateBackend(newBackend: T) {
    this.backend = newBackend;
  }

  recentServiceIds(): readonly ServiceId[] {
    return this._recentServiceIds;
  }

  getService(id: ServiceId): SerializedService | null {
    const serviceData = this.retrieveOptional(serialize.serviceData(id));
    if (serviceData === undefined) {
      return null;
    }

    if (!this._recentServiceIds.includes(id)) {
      this._recentServiceIds.push(id);
    }

    return new SerializedService(id, serviceData, (key) => this.retrieveOptional(key));
  }

  private retrieve<T>({ key, Codec }: KeyAndCodec<T>, description: string): T {
    const bytes = this.backend.get(key);
    if (bytes === null) {
      throw new Error(`Required state entry for ${description} is missing!. Accessing key: ${key}`);
    }
    return Decoder.decodeObject(Codec, bytes, this.spec);
  }

  private retrieveOptional<T>({ key, Codec }: KeyAndCodec<T>): T | undefined {
    const bytes = this.backend.get(key);
    if (bytes === null) {
      return undefined;
    }
    return Decoder.decodeObject(Codec, bytes, this.spec);
  }

  get availabilityAssignment(): State["availabilityAssignment"] {
    return this.retrieve(serialize.availabilityAssignment, "availabilityAssignment");
  }

  get designatedValidatorData(): State["designatedValidatorData"] {
    return this.retrieve(serialize.designatedValidators, "designatedValidatorData");
  }

  get nextValidatorData(): State["nextValidatorData"] {
    return this.retrieve(serialize.safrole, "safroleData.nextValidatorData").nextValidatorData;
  }

  get currentValidatorData(): State["currentValidatorData"] {
    return this.retrieve(serialize.currentValidators, "currentValidators");
  }

  get previousValidatorData(): State["previousValidatorData"] {
    return this.retrieve(serialize.previousValidators, "previousValidators");
  }

  get disputesRecords(): State["disputesRecords"] {
    return this.retrieve(serialize.disputesRecords, "disputesRecords");
  }

  get timeslot(): State["timeslot"] {
    return this.retrieve(serialize.timeslot, "timeslot");
  }

  get entropy(): State["entropy"] {
    return this.retrieve(serialize.entropy, "entropy");
  }

  get authPools(): State["authPools"] {
    return this.retrieve(serialize.authPools, "authPools");
  }

  get authQueues(): State["authQueues"] {
    return this.retrieve(serialize.authQueues, "authQueues");
  }

  get recentBlocks(): State["recentBlocks"] {
    return this.retrieve(serialize.recentBlocks, "recentBlocks");
  }

  get statistics(): State["statistics"] {
    return this.retrieve(serialize.statistics, "statistics");
  }

  get accumulationQueue(): State["accumulationQueue"] {
    return this.retrieve(serialize.accumulationQueue, "accumulationQueue");
  }

  get recentlyAccumulated(): State["recentlyAccumulated"] {
    return this.retrieve(serialize.recentlyAccumulated, "recentlyAccumulated");
  }

  get ticketsAccumulator(): State["ticketsAccumulator"] {
    return this.retrieve(serialize.safrole, "safroleData.ticketsAccumulator").ticketsAccumulator;
  }

  get sealingKeySeries(): State["sealingKeySeries"] {
    return this.retrieve(serialize.safrole, "safrole.sealingKeySeries").sealingKeySeries;
  }

  get epochRoot(): State["epochRoot"] {
    return this.retrieve(serialize.safrole, "safrole.epochRoot").epochRoot;
  }

  get privilegedServices(): State["privilegedServices"] {
    return this.retrieve(serialize.privilegedServices, "privilegedServices");
  }

  get accumulationOutputLog(): State["accumulationOutputLog"] {
    if (Compatibility.isGreaterOrEqual(GpVersion.V0_6_7)) {
      return this.retrieve(serialize.accumulationOutputLog, "accumulationOutputLog");
    }
    return [];
  }
}

/** Service data representation on a serialized state. */
export class SerializedService implements Service {
  constructor(
    /** Service id */
    public readonly serviceId: ServiceId,
    private readonly accountInfo: ServiceAccountInfo,
    private readonly retrieveOptional: <T>(key: KeyAndCodec<T>) => T | undefined,
  ) {}

  /** Service account info. */
  getInfo(): ServiceAccountInfo {
    return this.accountInfo;
  }

  /** Retrieve a storage item. */
  getStorage(rawKey: StorageKey): BytesBlob | null {
    if (Compatibility.isLessThan(GpVersion.V0_6_7)) {
      const serviceIdStorageKey = new Uint8Array(SERVICE_ID_BYTES + rawKey.length);
      serviceIdStorageKey.set(u32AsLeBytes(this.serviceId));
      serviceIdStorageKey.set(rawKey.raw, SERVICE_ID_BYTES);
      const hash = blake2b.hashBytes(serviceIdStorageKey);
      return this.retrieveOptional(serialize.serviceStorage(this.serviceId, hash.asOpaque())) ?? null;
    }

    return this.retrieveOptional(serialize.serviceStorage(this.serviceId, rawKey)) ?? null;
  }

  /**
   * Check if preimage is present in the DB.
   *
   * NOTE: it DOES NOT mean that the preimage is available.
   */
  hasPreimage(hash: PreimageHash): boolean {
    // TODO [ToDr] consider optimizing to avoid fetching the whole data.
    return this.retrieveOptional(serialize.servicePreimages(this.serviceId, hash)) !== undefined;
  }

  /** Retrieve preimage from the DB. */
  getPreimage(hash: PreimageHash): BytesBlob | null {
    return this.retrieveOptional(serialize.servicePreimages(this.serviceId, hash)) ?? null;
  }

  /** Retrieve preimage lookup history. */
  getLookupHistory(hash: PreimageHash, len: U32): LookupHistorySlots | null {
    const rawSlots = this.retrieveOptional(serialize.serviceLookupHistory(this.serviceId, hash, len));
    if (rawSlots === undefined) {
      return null;
    }
    return tryAsLookupHistorySlots(rawSlots.map(tryAsTimeSlot));
  }
}

type KeyAndCodec<T> = {
  key: StateKey;
  Codec: Decode<T>;
};
