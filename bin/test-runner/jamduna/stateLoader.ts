import { type ServiceId, type StateRootHash, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, type Descriptor, codec } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import {
  LookupHistoryItem,
  type PartialState,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  type State,
  StateItem,
} from "@typeberry/state";
import { serialize } from "@typeberry/state-merkleization/serialize";
import { fromJson } from "../w3f/codec/common";

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
  const partial: PartialState = {};
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
type Appender = (s: PartialState, value: BytesBlob, description: string) => void;

const kindMapping: { [k: string]: Appender } = {
  account_lookup: (s, value, description) => {
    const { serviceId, hash, len } = Parser.lookup(description);
    findOrAddService(s, serviceId).data.lookupHistory.push(
      new LookupHistoryItem(
        hash,
        len,
        asKnownSize(decode(codec.sequenceVarLen(codec.u32), value).map((x) => tryAsTimeSlot(x))),
      ),
    );
  },
  account_storage: (s, value, description) => {
    const { serviceId, key } = Parser.storage(description);
    findOrAddService(s, serviceId).data.storage.push(new StateItem(key, value));
  },
  account_preimage: (s, value, description) => {
    const { serviceId, hash } = Parser.preimage(description);
    findOrAddService(s, serviceId).data.preimages.push(new PreimageItem(hash, value));
  },
  service_account: (s, value, description) => {
    const { serviceId } = Parser.info(description);
    findOrAddService(s, serviceId).data.info = decode(ServiceAccountInfo.Codec, value);
  },
  c1: (s, value) => {
    s.authPools = decode(serialize.authPools.Codec, value);
  },
  c2: (s, value) => {
    s.authQueues = decode(serialize.authQueues.Codec, value);
  },
  c3: (s, value) => {
    s.recentBlocks = decode(serialize.recentBlocks.Codec, value);
  },
  c4: (s, value) => {
    const safrole = decode(serialize.safrole.Codec, value);
    s.nextValidatorData = safrole.nextValidatorData;
    s.epochRoot = safrole.epochRoot;
    s.sealingKeySeries = safrole.sealingKeySeries;
    s.ticketsAccumulator = safrole.ticketsAccumulator;
  },
  c5: (s, value) => {
    s.disputesRecords = decode(serialize.disputesRecords.Codec, value);
  },
  c6: (s, value) => {
    s.entropy = decode(serialize.entropy.Codec, value);
  },
  c7: (s, value) => {
    s.designatedValidatorData = decode(serialize.designatedValidators.Codec, value);
  },
  c8: (s, value) => {
    s.currentValidatorData = decode(serialize.currentValidators.Codec, value);
  },
  c9: (s, value) => {
    s.previousValidatorData = decode(serialize.previousValidators.Codec, value);
  },
  c10: (s, value) => {
    s.availabilityAssignment = decode(serialize.availabilityAssignment.Codec, value);
  },
  c11: (s, value) => {
    s.timeslot = decode(serialize.timeslot.Codec, value);
  },
  c12: (s, value) => {
    s.privilegedServices = decode(serialize.privilegedServices.Codec, value);
  },
  c13: (s, value) => {
    s.statisticsPerValidator = decode(serialize.statistics.Codec, value);
  },
  c14: (s, value) => {
    s.accumulationQueue = decode(serialize.accumulationQueue.Codec, value);
  },
  c15: (s, value) => {
    s.recentlyAccumulated = decode(serialize.recentlyAccumulated.Codec, value);
  },
};

function decode<T>(descriptor: Descriptor<T>, value: BytesBlob) {
  return Decoder.decodeObject(descriptor, value, tinyChainSpec);
}

function findOrAddService(s: PartialState, serviceId: ServiceId) {
  const services = s.services ?? new Map();
  s.services = services;
  const maybe_service = s.services.get(serviceId);
  
  if (maybe_service !== undefined) {
    return maybe_service;
  }
  
  const service = new Service(serviceId, {
    info: ServiceAccountInfo.fromCodec({
      codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
      balance: tryAsU64(0),
      accumulateMinGas: tryAsGas(10_000),
      onTransferMinGas: tryAsGas(1_000),
      storageUtilisationBytes: tryAsU64(0),
      storageUtilisationCount: tryAsU32(0),
    }),
    preimages: [],
    lookupHistory: [],
    storage: [],
  });
    
  s.services.set(serviceId, service);
  return service;
}
