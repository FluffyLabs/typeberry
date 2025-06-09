import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchRingRoot,
  type ServiceId,
  type TimeSlot,
  codecPerValidator,
} from "@typeberry/block";
import { codecHashDictionary } from "@typeberry/block/codec";
import type { PreimageHash } from "@typeberry/block/preimage";
import { Ticket } from "@typeberry/block/tickets";
import { type CodecRecord, codec, readonlyArray } from "@typeberry/codec";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import {
  InMemoryService,
  InMemoryState,
  LookupHistoryItem,
  PreimageItem,
  ServiceAccountInfo,
  type State,
  StorageItem,
  ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data";
import { seeThrough } from "@typeberry/utils";
import { serialize } from "./serialize";

type LookupHistoryEntry = {
  key: PreimageHash;
  data: LookupHistoryItem[];
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
      storage: codecHashDictionary(StorageItem.Codec, (x) => x.hash),
    }),
  });

  private constructor(id: ServiceId, data: InMemoryService["data"]) {
    super(id, data);
  }

  static create({ serviceId, data }: CodecRecord<ServiceWithCodec>) {
    return new ServiceWithCodec(serviceId, data);
  }
}

export const inMemoryStateCodec = codec.Class<InMemoryState>(InMemoryState, {
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
  // theta
  accumulationQueue: serialize.accumulationQueue.Codec,
  // xi
  recentlyAccumulated: serialize.recentlyAccumulated.Codec,
  // delta
  services: codec.dictionary(codec.u32.asOpaque<ServiceId>(), ServiceWithCodec.Codec, {
    sortKeys: (a, b) => a - b,
  }),
});
