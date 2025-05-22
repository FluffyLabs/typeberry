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
  LookupHistoryItem,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  type State,
  StateItem,
  ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { SafroleSealingKeysData } from "@typeberry/state/safrole-data";
import { seeThrough } from "@typeberry/utils";
import { serialize } from "./serialize";

type LookupHistoryEntry = {
  key: PreimageHash;
  data: readonly LookupHistoryItem[];
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
  data: readonlyArray(codec.sequenceVarLen(lookupHistoryItemCodec)),
});

const lookupHistoryCodec = codec
  .sequenceVarLen(lookupHistoryEntryCodec)
  .convert<HashDictionary<PreimageHash, readonly LookupHistoryItem[]>>(
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
    // TODO [ToDr] we have a bug here, if there are multiple entries for the same hash
    // (only one will end up in the dictionary)
    (data): HashDictionary<PreimageHash, readonly LookupHistoryItem[]> =>
      HashDictionary.fromEntries(data.map((x) => [x.key, x.data])),
  );

class ServiceWithCodec extends Service {
  static Codec = codec.Class(ServiceWithCodec, {
    id: codec.u32.asOpaque<ServiceId>(),
    data: codec.object<Service["data"]>({
      info: ServiceAccountInfo.Codec,
      // TODO [ToDr] These two instances of code should go away.
      // we shouldn't be serializing it like that.
      preimages: codecHashDictionary(PreimageItem.Codec, (x) => x.hash).convert(
        (x) => (x instanceof HashDictionary ? x : HashDictionary.fromEntries(Array.from(x))),
        (y) => y,
      ),
      lookupHistory: lookupHistoryCodec.convert(
        (x) => (x instanceof HashDictionary ? x : HashDictionary.fromEntries(Array.from(x))),
        (y) => y,
      ),
      storage: readonlyArray(codec.sequenceVarLen(StateItem.Codec)),
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
    ticketsAccumulator: readonlyArray(codec.sequenceVarLen(Ticket.Codec)).convert(seeThrough, asKnownSize),
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
