import { type ServiceId, tryAsTimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type Decode, Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { U32 } from "@typeberry/numbers";
import {
  type LookupHistorySlots,
  type Service,
  type ServiceAccountInfo,
  type State,
  type StorageKey,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import type { StateKey } from "./keys";
import { serialize } from "./serialize";

export interface Persistence {
  get(key: StateKey): BytesBlob | undefined;
}

type KeyAndCodec<T> = {
  key: StateKey;
  Codec: Decode<T>;
};

export class SerializedService implements Service {
  constructor(
    public readonly serviceId: ServiceId,
    private readonly accountInfo: ServiceAccountInfo,
    private readonly retrieveOptional: <T>(key: KeyAndCodec<T>) => T | undefined,
  ) {}

  getInfo(): ServiceAccountInfo {
    return this.accountInfo;
  }

  getStorage(storage: StorageKey): BytesBlob | null {
    return this.retrieveOptional(serialize.serviceStorage(this.serviceId, storage)) ?? null;
  }

  hasPreimage(hash: PreimageHash): boolean {
    // TODO [ToDr] consider optimizing to avoid fetching the whole data.
    return this.retrieveOptional(serialize.servicePreimages(this.serviceId, hash)) !== undefined;
  }

  getPreimage(hash: PreimageHash): BytesBlob | null {
    return this.retrieveOptional(serialize.servicePreimages(this.serviceId, hash)) ?? null;
  }

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
export class SerializedState implements State {
  constructor(
    private readonly backend: Persistence,
    private readonly spec: ChainSpec,
  ) {}

  getService(id: ServiceId): Service | null {
    // TODO [ToDr] should we maintain a collection of services somewhere?
    const serviceData = this.retrieveOptional(serialize.serviceData(id));
    if (serviceData === undefined) {
      return null;
    }

    return new SerializedService(id, serviceData, (key) => this.retrieveOptional(key));
  }

  private retrieve<T>(
    {
      key,
      Codec,
    }: {
      key: StateKey;
      Codec: Decode<T>;
    },
    description: string,
  ): T {
    const bytes = this.backend.get(key);
    if (bytes === undefined) {
      throw new Error(`Required state entry for ${description} is missing!. Accessing key: ${key}`);
    }
    return Decoder.decodeObject(Codec, bytes, this.spec);
  }

  private retrieveOptional<T>({
    key,
    Codec,
  }: {
    key: StateKey;
    Codec: Decode<T>;
  }): T | undefined {
    const bytes = this.backend.get(key);
    if (bytes !== undefined) {
      return Decoder.decodeObject(Codec, bytes, this.spec);
    }
    return bytes;
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
