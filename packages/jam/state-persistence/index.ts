import type { BytesBlob } from "@typeberry/bytes";
import { type Decode, Decoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { State } from "@typeberry/state";
import type { StateKey } from "@typeberry/state-merkleization/keys";
import { serialize } from "@typeberry/state-merkleization/serialize";

export interface Persistence {
  get(key: StateKey): BytesBlob;
}

export class ImmutableState implements State {
  constructor(
    private readonly backend: Persistence,
    private readonly spec: ChainSpec,
  ) {}

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

  get services(): State["services"] {
    throw new Error("not implemented yet");
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
