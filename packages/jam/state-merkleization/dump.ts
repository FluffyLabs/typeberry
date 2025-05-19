import {
  BANDERSNATCH_RING_ROOT_BYTES,
  type BandersnatchRingRoot,
  type ServiceId,
  type TimeSlot,
  codecPerValidator,
} from "@typeberry/block";
import { codecHashDictionary } from "@typeberry/block/codec.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import { Ticket } from "@typeberry/block/tickets.js";
import { type CodecRecord, codec } from "@typeberry/codec";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import {
  LookupHistoryItem,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  type State,
  StateItem,
  ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data.js";
import { seeThrough } from "@typeberry/utils";
import { serialize } from "./serialize.js";

type LookupHistoryEntry = {
  key: PreimageHash;
  data: LookupHistoryItem[];
};

const lookupHistoryItemCodec = codec.object<LookupHistoryItem>(
  {
    hash: codec.bytes(HASH_SIZE).asOpaque<PreimageHash>(),
    length: codec.u32,
    slots: codec.sequenceVarLen(codec.u32.asOpaque<TimeSlot>()).convert(
      (i) => seeThrough(i),
      (o) => tryAsLookupHistorySlots(o),
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
    (data): HashDictionary<PreimageHash, LookupHistoryItem[]> =>
      HashDictionary.fromEntries(data.map((x) => [x.key, x.data])),
  );

class ServiceWithCodec extends Service {
  static Codec = codec.Class(ServiceWithCodec, {
    id: codec.u32.asOpaque<ServiceId>(),
    data: codec.object({
      info: ServiceAccountInfo.Codec,
      preimages: codecHashDictionary(PreimageItem.Codec, (x) => x.hash),
      lookupHistory: lookupHistoryCodec,
      storage: codec.sequenceVarLen(StateItem.Codec),
    }),
  });
  static create({ id, data }: CodecRecord<ServiceWithCodec>) {
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
    epochRoot: codec.bytes(BANDERSNATCH_RING_ROOT_BYTES).asOpaque<BandersnatchRingRoot>(),
    // gamma_s
    sealingKeySeries: SafroleSealingKeysData.Codec,
    // gamma_a
    ticketsAccumulator: codec.sequenceVarLen(Ticket.Codec).convert(seeThrough, asKnownSize),
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
  },
  "State",
  (state: State) => state,
);
