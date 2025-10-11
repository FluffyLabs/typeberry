import { codecPerValidator, type ServiceId, type TimeSlot } from "@typeberry/block";
import { type CodecHashDictionaryOptions, codecHashDictionary } from "@typeberry/block/codec.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Ticket } from "@typeberry/block/tickets.js";
import { type CodecRecord, codec, Descriptor, readonlyArray, TYPICAL_DICTIONARY_LENGTH } from "@typeberry/codec";
import { asKnownSize, HashDictionary } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_RING_ROOT_BYTES, type BandersnatchRingRoot } from "@typeberry/crypto/bandersnatch.js";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { Ordering } from "@typeberry/ordering";
import {
  InMemoryService,
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  type State,
  StorageItem,
  tryAsLookupHistorySlots,
  ValidatorData,
} from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data.js";
import { seeThrough } from "@typeberry/utils";
import { serialize } from "./serialize.js";

type LookupHistoryEntry = {
  key: PreimageHash;
  data: LookupHistoryItem[];
};

/** Codec for a map with string keys. */
export const codecMap = <T>(
  value: Descriptor<T>,
  extractKey: (val: T) => string,
  {
    typicalLength = TYPICAL_DICTIONARY_LENGTH,
    compare = (a, b) => {
      const keyA = extractKey(a);
      const keyB = extractKey(b);

      if (keyA < keyB) {
        return Ordering.Less;
      }

      if (keyA > keyB) {
        return Ordering.Greater;
      }

      return Ordering.Equal;
    },
  }: CodecHashDictionaryOptions<T> = {},
): Descriptor<Map<string, T>> => {
  return Descriptor.new(
    `Map<${value.name}>[?]`,
    {
      bytes: typicalLength * value.sizeHint.bytes,
      isExact: false,
    },
    (e, v) => {
      const data = Array.from(v.values());
      data.sort((a, b) => compare(a, b).value);

      e.varU32(tryAsU32(data.length));

      for (const v of data) {
        value.encode(e, v);
      }
    },
    (d) => {
      const map = new Map<string, T>();
      const len = d.varU32();
      let prevValue = null as null | T;
      for (let i = 0; i < len; i += 1) {
        const v = value.decode(d);
        const k = extractKey(v);
        if (map.has(k)) {
          throw new Error(`Duplicate item in the dictionary encoding: "${k}"!`);
        }
        if (prevValue !== null && compare(prevValue, v).isGreaterOrEqual()) {
          throw new Error(
            `The keys in dictionary encoding are not sorted "${extractKey(prevValue)}" >= "${extractKey(v)}"!`,
          );
        }
        map.set(k, v);
        prevValue = v;
      }
      return map;
    },
    (s) => {
      const len = s.decoder.varU32();
      s.sequenceFixLen(value, len);
    },
  );
};

const lookupHistoryItemCodec = codec.object<LookupHistoryItem>(
  {
    hash: codec.bytes(HASH_SIZE).asOpaque<PreimageHash>(),
    length: codec.u32,
    slots: readonlyArray(codec.sequenceVarLen(codec.u32.asOpaque<TimeSlot>())).convert(
      seeThrough,
      tryAsLookupHistorySlots,
    ),
  },
  "LookupHistoryItem",
  ({ hash, length, slots }) => new LookupHistoryItem(hash, length, slots),
);

const lookupHistoryEntryCodec = codec.object<LookupHistoryEntry>({
  key: codec.bytes(HASH_SIZE).asOpaque<PreimageHash>(),
  data: codec.sequenceVarLen(lookupHistoryItemCodec),
});

const lookupHistoryCodec = codec
  .sequenceVarLen(lookupHistoryEntryCodec)
  .convert<HashDictionary<PreimageHash, LookupHistoryItem[]>>(
    (dict) => {
      const entries: LookupHistoryEntry[] = [];
      for (const [key, data] of dict) {
        entries.push({
          key,
          data,
        });
      }
      return entries;
    },
    (items): HashDictionary<PreimageHash, LookupHistoryItem[]> => {
      const dict = HashDictionary.new<PreimageHash, LookupHistoryItem[]>();
      for (const { key, data } of items) {
        const items = dict.get(key) ?? [];
        items.push(...data);
        dict.set(key, items);
      }
      return dict;
    },
  );

class ServiceWithCodec extends InMemoryService {
  static Codec = codec.Class(ServiceWithCodec, {
    serviceId: codec.u32.asOpaque<ServiceId>(),
    data: codec.object<InMemoryService["data"]>({
      info: ServiceAccountInfo.Codec,
      preimages: codecHashDictionary(PreimageItem.Codec, (x) => x.hash),
      lookupHistory: lookupHistoryCodec,
      storage: codecMap(StorageItem.Codec, (x) => x.key.toString()),
    }),
  });

  private constructor(id: ServiceId, data: InMemoryService["data"]) {
    super(id, data);
  }

  static create({ serviceId, data }: CodecRecord<ServiceWithCodec>) {
    return new ServiceWithCodec(serviceId, data);
  }
}

export const inMemoryStateCodec = (spec: ChainSpec) =>
  codec.Class(
    class State extends InMemoryState {
      static create(data: CodecRecord<InMemoryState>) {
        return InMemoryState.new(spec, data);
      }
    },
    {
      // alpha
      authPools: serialize.authPools.Codec,
      // phi
      authQueues: serialize.authQueues.Codec,
      // beta
      recentBlocks: serialize.recentBlocks.Codec,
      // gamma_k
      nextValidatorData: codecPerValidator(ValidatorData.Codec),
      // gamma_z
      epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque<BandersnatchRingRoot>(),
      // gamma_s
      sealingKeySeries: SafroleSealingKeysData.Codec,
      // gamma_a
      ticketsAccumulator: readonlyArray(codec.sequenceVarLen(Ticket.Codec)).convert<State["ticketsAccumulator"]>(
        (x) => x,
        asKnownSize,
      ),
      // psi
      disputesRecords: serialize.disputesRecords.Codec,
      // eta
      entropy: serialize.entropy.Codec,
      // iota
      designatedValidatorData: serialize.designatedValidators.Codec,
      // kappa
      currentValidatorData: serialize.currentValidators.Codec,
      // lambda
      previousValidatorData: serialize.previousValidators.Codec,
      // rho
      availabilityAssignment: serialize.availabilityAssignment.Codec,
      // tau
      timeslot: serialize.timeslot.Codec,
      // chi
      privilegedServices: serialize.privilegedServices.Codec,
      // pi
      statistics: serialize.statistics.Codec,
      // omega
      accumulationQueue: serialize.accumulationQueue.Codec,
      // xi
      recentlyAccumulated: serialize.recentlyAccumulated.Codec,
      // theta
      accumulationOutputLog: serialize.accumulationOutputLog.Codec,
      // delta
      services: codec.dictionary(codec.u32.asOpaque<ServiceId>(), ServiceWithCodec.Codec, {
        sortKeys: (a, b) => a - b,
      }),
    },
  );
