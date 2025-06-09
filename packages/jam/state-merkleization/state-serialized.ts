import { type ServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import { BytesBlob } from "@typeberry/bytes";
import { type Decode, Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { U32 } from "@typeberry/numbers";
import {
  EnumerableState,
  type LookupHistorySlots,
  type Service,
  type ServiceAccountInfo,
  type State,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { serialize } from "./serialize";
import {StateKey} from "./keys";
import {HashDictionary} from "@typeberry/collections";

/** A tiny wrapper for some persistence layer. */
export interface Persistence {
  /** Retrieve given state key. */
  get(key: StateKey): BytesBlob | null;
}

/**
 * Wrap a `HashDictionary` as `Peristence` object.
 *
 * Reminder: DO not do that with regular `Map`, since it compares by reference.
 */
export function hashDictPersistence(dict: HashDictionary<StateKey, BytesBlob>): Persistence {
  return {
    get(key: StateKey): BytesBlob | null {
      return dict.get(key) ?? null;
    }
  };
}

type KeyAndCodec<T> = {
  key: StateKey;
  Codec: Decode<T>;
};

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
  getStorage(storage: StorageKey): BytesBlob | null {
    return this.retrieveOptional(serialize.serviceStorage(this.serviceId, storage)) ?? null;
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

/**
 * A potentially persistence-backed state object which stores the keys serialized.
 *
 * It differs from `InMemoryState` by needing to serialize the keys before accessing
 * them.
 */
export class SerializedState<T extends Persistence = Persistence> implements State, EnumerableState {
  private _recentServiceIds: ServiceId[] = [];

  constructor(
    private readonly spec: ChainSpec,
    public readonly backend: T,
  ) {}

  recentServiceIds(): readonly ServiceId[] {
    return this._recentServiceIds;
  }

  getService(id: ServiceId): SerializedService | null {
    const serviceData = this.retrieveOptional(serialize.serviceData(id));
    if (serviceData === undefined) {
      return null;
    }

    if (this._recentServiceIds.indexOf(id) === -1) {
      this._recentServiceIds.push(id);
    }

    return new SerializedService(id, serviceData, (key) => this.retrieveOptional(key));
  }

  private retrieve<T>(
    {
      key,
      Codec,
    }: KeyAndCodec<T>,
    description: string,
  ): T {
    const bytes = this.backend.get(key);
    if (bytes === null) {
      throw new Error(`Required state entry for ${description} is missing!. Accessing key: ${key}`);
    }
    return Decoder.decodeObject(Codec, bytes, this.spec);
  }

  private retrieveOptional<T>({
    key,
    Codec,
  }: KeyAndCodec<T>): T | undefined {
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
}
