import { type StateRootHash, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, type Descriptor, codec } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  PreimageItem,
  PreimageUpdate,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  StateUpdate,
  StorageItem,
  UpdateService,
  UpdateStorage,
} from "@typeberry/state";
import { serialize } from "@typeberry/state-merkleization/serialize";

export class TestState {
  static fromJson: FromJson<TestState> = {
    state_root: fromJson.bytes32(),
    keyvals: json.array(json.array("string")),
  };
  state_root!: StateRootHash;
  keyvals!: StateKeyVal[];
}

export type StateKeyVal = string[];

export function loadState(testState: StateKeyVal[]): State {
  const partial = {
    services: new Map(),
  };
  for (const [_key, value, kind, description] of testState) {
    const appender = kindMapping[kind];
    if (appender === undefined) {
      throw new Error(`Missing kind mapping for: ${kind}`);
    }
    appender(partial, BytesBlob.parseBlob(value), description);
  }
  return partial as State;
}

// A hacky set of parsers to avoid decoding the state keys.
class Parser {
  static lookup(description: string) {
    const [service, hashLen] = description.split("|");
    const [hash, len] = hashLen.split(" ");
    return {
      serviceId: tryAsServiceId(Number.parseInt(service.replace("s=", ""))),
      hash: Bytes.parseBytes(hash.replace("h=", ""), HASH_SIZE).asOpaque(),
      len: tryAsU32(Number.parseInt(len.replace("l=", ""))),
    };
  }

  static storage(description: string) {
    const [service, hashKey] = description.split("|");
    const [hash, key] = hashKey.split(" ");
    return {
      serviceId: tryAsServiceId(Number.parseInt(service.replace("s=", ""))),
      hash: Bytes.parseBytes(hash.replace("hk=", ""), HASH_SIZE).asOpaque(),
      key: Bytes.parseBytes(key.replace("k=", ""), HASH_SIZE).asOpaque(),
    };
  }

  static preimage(description: string) {
    const [service, hash, len] = description.split("|");
    return {
      serviceId: tryAsServiceId(Number.parseInt(service.replace("s=", ""))),
      hash: Bytes.parseBytes(hash.replace("h=", ""), HASH_SIZE).asOpaque(),
      len: tryAsU32(Number.parseInt(len.replace("plen=", ""))),
    };
  }

  static info(description: string) {
    const [service] = description.split("|");
    return {
      serviceId: tryAsServiceId(Number.parseInt(service.replace("s=", ""))),
    };
  }
}

// Takes the state and value and insert it into the state.
type Appender = (s: Partial<State>, value: BytesBlob, description: string) => StateUpdate<State & ServicesUpdate>;

const kindMapping: { [k: string]: Appender } = {
  account_lookup: (_s, value, description) => {
    const { serviceId, hash, len } = Parser.lookup(description);
    const lookupHistory = new LookupHistoryItem(
      hash,
      len,
      asKnownSize(decode(codec.sequenceVarLen(codec.u32), value).map((x) => tryAsTimeSlot(x))),
    );

    return StateUpdate.new({
      preimages: [
        PreimageUpdate.updateOrAdd({
          serviceId,
          lookupHistory,
        }),
      ],
    });
  },
  account_storage: (_s, blob, description) => {
    const { serviceId, hash } = Parser.storage(description);
    const storage = StorageItem.create({ hash, blob });

    return StateUpdate.new({
      storage: [
        UpdateStorage.set({
          serviceId,
          storage,
        }),
      ],
    });
  },
  account_preimage: (_s, blob, description) => {
    const { serviceId, hash } = Parser.preimage(description);
    const preimage = PreimageItem.create({ hash, blob });

    return StateUpdate.new({
      preimages: [
        PreimageUpdate.provide({
          serviceId,
          preimage,
          slot: null,
        }),
      ],
    });
  },
  service_account: (_s, blob, description) => {
    const { serviceId } = Parser.info(description);
    const serviceInfo = decode(ServiceAccountInfo.Codec, blob);

    return StateUpdate.new({
      servicesUpdates: [
        UpdateService.create({
          serviceId,
          serviceInfo,
          lookupHistory: [],
        }),
      ],
    });
  },
  c1: (_s, value) =>
    StateUpdate.new({
      authPools: decode(serialize.authPools.Codec, value),
    }),
  c2: (_s, value) =>
    StateUpdate.new({
      authQueues: decode(serialize.authQueues.Codec, value),
    }),
  c3: (_s, value) =>
    StateUpdate.new({
      recentBlocks: decode(serialize.recentBlocks.Codec, value),
    }),
  c4: (_s, value) => {
    const safrole = decode(serialize.safrole.Codec, value);
    return StateUpdate.new({
      nextValidatorData: safrole.nextValidatorData,
      epochRoot: safrole.epochRoot,
      sealingKeySeries: safrole.sealingKeySeries,
      ticketsAccumulator: safrole.ticketsAccumulator,
    });
  },
  c5: (_s, value) =>
    StateUpdate.new({
      disputesRecords: decode(serialize.disputesRecords.Codec, value),
    }),
  c6: (_s, value) =>
    StateUpdate.new({
      entropy: decode(serialize.entropy.Codec, value),
    }),
  c7: (_s, value) =>
    StateUpdate.new({
      designatedValidatorData: decode(serialize.designatedValidators.Codec, value),
    }),
  c8: (_s, value) =>
    StateUpdate.new({
      currentValidatorData: decode(serialize.currentValidators.Codec, value),
    }),
  c9: (_s, value) =>
    StateUpdate.new({
      previousValidatorData: decode(serialize.previousValidators.Codec, value),
    }),
  c10: (_s, value) =>
    StateUpdate.new({
      availabilityAssignment: decode(serialize.availabilityAssignment.Codec, value),
    }),
  c11: (_s, value) =>
    StateUpdate.new({
      timeslot: decode(serialize.timeslot.Codec, value),
    }),
  c12: (_s, value) =>
    StateUpdate.new({
      privilegedServices: decode(serialize.privilegedServices.Codec, value),
    }),
  c13: (_s, value) =>
    StateUpdate.new({
      statistics: decode(serialize.statistics.Codec, value),
    }),
  c14: (_s, value) =>
    StateUpdate.new({
      accumulationQueue: decode(serialize.accumulationQueue.Codec, value),
    }),
  c15: (_s, value) =>
    StateUpdate.new({
      recentlyAccumulated: decode(serialize.recentlyAccumulated.Codec, value),
    }),
};

function decode<T>(descriptor: Descriptor<T>, value: BytesBlob) {
  return Decoder.decodeObject(descriptor, value, tinyChainSpec);
}
