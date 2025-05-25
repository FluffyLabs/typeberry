import type { ServiceId } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { BytesBlob } from "@typeberry/bytes";
import { type Decode, Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type {
  LookupHistoryItem,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  State,
  StorageItem,
  StorageKey,
} from "@typeberry/state";
import type { StateKey } from "@typeberry/state-merkleization/keys";
import { serialize } from "@typeberry/state-merkleization/serialize";

export interface Persistence {
  get(key: StateKey): BytesBlob;
}

export class DbService implements Service {
  info(): ServiceAccountInfo {
    throw new Error("Method not implemented.");
  }
  storage(_storage: StorageKey): StorageItem | null {
    throw new Error("Method not implemented.");
  }
  hasPreimage(_hash: PreimageHash): boolean {
    throw new Error("Method not implemented.");
  }
  preimage(_hash: PreimageHash): PreimageItem | null {
    throw new Error("Method not implemented.");
  }
  lookupHistory(_hash: PreimageHash): LookupHistoryItem[] | null {
    throw new Error("Method not implemented.");
  }
}

export class DbState implements State {
  constructor(
    private readonly backend: Persistence,
    private readonly spec: ChainSpec,
  ) {}

  service(_id: ServiceId): Service | null {
    throw new Error("Method not implemented.");
  }

  private retrieve<T>({
    key,
    Codec,
  }: {
    key: StateKey;
    Codec: Decode<T>;
  }): T {
    const bytes = this.backend.get(key);
    return Decoder.decodeObject(Codec, bytes, this.spec);
  }

  get availabilityAssignment(): State["availabilityAssignment"] {
    return this.retrieve(serialize.availabilityAssignment);
  }

  get designatedValidatorData(): State["designatedValidatorData"] {
    return this.retrieve(serialize.designatedValidators);
  }

  get nextValidatorData(): State["nextValidatorData"] {
    return this.retrieve(serialize.safrole).nextValidatorData;
  }

  get currentValidatorData(): State["currentValidatorData"] {
    return this.retrieve(serialize.currentValidators);
  }

  get previousValidatorData(): State["previousValidatorData"] {
    return this.retrieve(serialize.previousValidators);
  }

  get disputesRecords(): State["disputesRecords"] {
    return this.retrieve(serialize.disputesRecords);
  }

  get timeslot(): State["timeslot"] {
    return this.retrieve(serialize.timeslot);
  }

  get entropy(): State["entropy"] {
    return this.retrieve(serialize.entropy);
  }

  get authPools(): State["authPools"] {
    return this.retrieve(serialize.authPools);
  }

  get authQueues(): State["authQueues"] {
    return this.retrieve(serialize.authQueues);
  }

  get recentBlocks(): State["recentBlocks"] {
    return this.retrieve(serialize.recentBlocks);
  }

  get statistics(): State["statistics"] {
    return this.retrieve(serialize.statistics);
  }

  get accumulationQueue(): State["accumulationQueue"] {
    return this.retrieve(serialize.accumulationQueue);
  }

  get recentlyAccumulated(): State["recentlyAccumulated"] {
    return this.retrieve(serialize.recentlyAccumulated);
  }

  get ticketsAccumulator(): State["ticketsAccumulator"] {
    return this.retrieve(serialize.safrole).ticketsAccumulator;
  }

  get sealingKeySeries(): State["sealingKeySeries"] {
    return this.retrieve(serialize.safrole).sealingKeySeries;
  }

  get epochRoot(): State["epochRoot"] {
    return this.retrieve(serialize.safrole).epochRoot;
  }

  get privilegedServices(): State["privilegedServices"] {
    return this.retrieve(serialize.privilegedServices);
  }
}
