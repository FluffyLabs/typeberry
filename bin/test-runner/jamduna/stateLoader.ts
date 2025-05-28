import { type StateRootHash, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { fromJson } from "@typeberry/block-json";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, type Descriptor, codec } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import {
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  type StateUpdate,
  StorageItem,
  UpdatePreimage,
  UpdateService,
  UpdateStorage,
  mergeStateUpdates,
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

export function loadState(spec: ChainSpec, stateData: StateKeyVal[]): InMemoryState {
  const state = InMemoryState.empty(spec);
  const updates: StateUpdate<State & ServicesUpdate>[] = [];
  for (const [_key, value, kind, description] of stateData) {
    const appender = kindMapping[kind];
    if (appender === undefined) {
      throw new Error(`Missing kind mapping for: ${kind}`);
    }
    updates.push(appender(BytesBlob.parseBlob(value), description));
  }
  const update = mergeStateUpdates(updates);
  return state.applyUpdate(update);
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
type Appender = (value: BytesBlob, description: string) => StateUpdate<State & ServicesUpdate>;

const kindMapping: { [k: string]: Appender } = {
  account_lookup: (value, description) => {
    const { serviceId, hash, len } = Parser.lookup(description);
    const lookupHistory = new LookupHistoryItem(
      hash,
      len,
      asKnownSize(decode(codec.sequenceVarLen(codec.u32), value).map((x) => tryAsTimeSlot(x))),
    );

    return {
      preimages: [
        UpdatePreimage.updateOrAdd({
          serviceId,
          lookupHistory,
        }),
      ],
    };
  },
  account_storage: (blob, description) => {
    const { serviceId, hash } = Parser.storage(description);
    const storage = StorageItem.create({ hash, blob });

    return {
      storage: [
        UpdateStorage.set({
          serviceId,
          storage,
        }),
      ],
    };
  },
  account_preimage: (blob, description) => {
    const { serviceId, hash } = Parser.preimage(description);
    const preimage = PreimageItem.create({ hash, blob });

    return {
      preimages: [
        UpdatePreimage.provide({
          serviceId,
          preimage,
          slot: null,
        }),
      ],
    };
  },
  service_account: (blob, description) => {
    const { serviceId } = Parser.info(description);
    const serviceInfo = decode(ServiceAccountInfo.Codec, blob);

    return {
      servicesUpdates: [
        UpdateService.create({
          serviceId,
          serviceInfo,
          lookupHistory: null,
        }),
      ],
    };
  },
  c1: (value) => ({
    authPools: decode(serialize.authPools.Codec, value),
  }),
  c2: (value) => ({
    authQueues: decode(serialize.authQueues.Codec, value),
  }),
  c3: (value) => ({
    recentBlocks: decode(serialize.recentBlocks.Codec, value),
  }),
  c4: (value) => {
    const safrole = decode(serialize.safrole.Codec, value);
    return {
      nextValidatorData: safrole.nextValidatorData,
      epochRoot: safrole.epochRoot,
      sealingKeySeries: safrole.sealingKeySeries,
      ticketsAccumulator: safrole.ticketsAccumulator,
    };
  },
  c5: (value) => ({
    disputesRecords: decode(serialize.disputesRecords.Codec, value),
  }),
  c6: (value) => ({
    entropy: decode(serialize.entropy.Codec, value),
  }),
  c7: (value) => ({
    designatedValidatorData: decode(serialize.designatedValidators.Codec, value),
  }),
  c8: (value) => ({
    currentValidatorData: decode(serialize.currentValidators.Codec, value),
  }),
  c9: (value) => ({
    previousValidatorData: decode(serialize.previousValidators.Codec, value),
  }),
  c10: (value) => ({
    availabilityAssignment: decode(serialize.availabilityAssignment.Codec, value),
  }),
  c11: (value) => ({
    timeslot: decode(serialize.timeslot.Codec, value),
  }),
  c12: (value) => ({
    privilegedServices: decode(serialize.privilegedServices.Codec, value),
  }),
  c13: (value) => ({
    statistics: decode(serialize.statistics.Codec, value),
  }),
  c14: (value) => ({
    accumulationQueue: decode(serialize.accumulationQueue.Codec, value),
  }),
  c15: (value) => ({
    recentlyAccumulated: decode(serialize.recentlyAccumulated.Codec, value),
  }),
};

function decode<T>(descriptor: Descriptor<T>, value: BytesBlob) {
  return Decoder.decodeObject(descriptor, value, tinyChainSpec);
}
