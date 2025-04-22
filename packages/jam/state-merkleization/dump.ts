import { BANDERSNATCH_RING_ROOT_BYTES, type ServiceId, codecPerValidator } from "@typeberry/block";
import { codecHashDictionary } from "@typeberry/block/codec";
import type { PreimageHash } from "@typeberry/block/preimage";
import { Ticket } from "@typeberry/block/tickets";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HashDictionary } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import {
  LookupHistoryItem,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  type State,
  StateItem,
  ValidatorData,
} from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data";
import { serialize } from "./serialize";

type LookupHistoryEntry = {
  key: PreimageHash;
  data: LookupHistoryItem[];
};

const lookupHistoryItemCodec = codec.object<LookupHistoryItem>(
  {
    hash: codec.bytes(HASH_SIZE).asOpaque(),
    length: codec.u32,
    slots: codec.sequenceVarLen(codec.u32.asOpaque<"TimeSlot[u32]">()).asOpaque(),
  },
  "LookupHistoryItem",
  ({ hash, length, slots }) => new LookupHistoryItem(hash, length, slots),
);

const lookupHistoryEntryCodec = codec.object<LookupHistoryEntry>({
  key: codec.bytes(HASH_SIZE).asOpaque(),
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
    (data): HashDictionary<PreimageHash, LookupHistoryItem[]> =>
      HashDictionary.fromEntries(data.map((x) => [x.key, x.data])),
  );

class ServiceWithCodec extends Service {
  static Codec = codec.Class(ServiceWithCodec, {
    id: codec.u32.asOpaque(),
    data: codec.object({
      info: ServiceAccountInfo.Codec,
      preimages: codecHashDictionary(PreimageItem.Codec, (x) => x.hash),
      lookupHistory: lookupHistoryCodec,
      storage: codec.sequenceVarLen(StateItem.Codec),
    }),
  });
  static fromCodec({ id, data }: CodecRecord<ServiceWithCodec>) {
    return new ServiceWithCodec(id, data);
  }
}

export const stateDumpCodec = codec.object<State>(
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
    epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque(),
    // gamma_s
    sealingKeySeries: SafroleSealingKeysData.Codec,
    // gamma_a
    ticketsAccumulator: codec.sequenceVarLen(Ticket.Codec).asOpaque(),
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
    statisticsPerValidator: serialize.statistics.Codec,
    // theta
    accumulationQueue: serialize.accumulationQueue.Codec,
    // xi
    recentlyAccumulated: serialize.recentlyAccumulated.Codec,
    // delta
    services: codec.dictionary(codec.u32.asOpaque(), ServiceWithCodec.Codec, {
      sortKeys: (a: ServiceId, b: ServiceId) => a - b,
    }),
  },
  "State",
  (state: State) => state,
);
