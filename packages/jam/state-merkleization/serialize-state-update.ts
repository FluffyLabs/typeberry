import type { ServiceId } from "@typeberry/block";
import { BytesBlob } from "@typeberry/bytes";
import { type Encode, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { tryAsU32 } from "@typeberry/numbers";
import {
  SafroleData,
  type ServicesUpdate,
  type State,
  type UpdatePreimage,
  UpdatePreimageKind,
  type UpdateService,
  UpdateServiceKind,
  type UpdateStorage,
  UpdateStorageKind,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { assertNever } from "@typeberry/utils";
import type { StateKey } from "./keys.js";
import { type StateCodec, serialize } from "./serialize.js";

/** What should be done with that key? */
export enum StateEntryUpdateAction {
  /** Insert an entry. */
  Insert = 0,
  /** Remove an entry. */
  Remove = 1,
}

export type StateEntryUpdate = [StateEntryUpdateAction, StateKey, BytesBlob];

const EMPTY_BLOB = BytesBlob.empty();

/** Serialize given state update into a series of key-value pairs. */
export function* serializeStateUpdate(
  spec: ChainSpec,
  update: Partial<State & ServicesUpdate>,
): Generator<StateEntryUpdate> {
  // first let's serialize all of the simple entries (if present!)
  yield* serializeBasicKeys(spec, update);

  const encode = <T>(codec: Encode<T>, val: T) => Encoder.encodeObject(codec, val, spec);

  // then let's proceed with service updates
  yield* serializeServiceUpdates(update.servicesUpdates, encode);
  yield* serializePreimages(update.preimages, encode);
  yield* serializeStorage(update.storage);
  yield* serializeRemovedServices(update.servicesRemoved);
}

function* serializeRemovedServices(servicesRemoved: ServiceId[] | undefined): Generator<StateEntryUpdate> {
  for (const serviceId of servicesRemoved ?? []) {
    // TODO [ToDr] what about all data associated with a service?
    const codec = serialize.serviceData(serviceId);
    yield [StateEntryUpdateAction.Remove, codec.key, EMPTY_BLOB];
  }
}

function* serializeStorage(storage: UpdateStorage[] | undefined): Generator<StateEntryUpdate> {
  for (const { action, serviceId } of storage ?? []) {
    switch (action.kind) {
      case UpdateStorageKind.Set: {
        const codec = serialize.serviceStorage(serviceId, action.storage.hash);
        yield [StateEntryUpdateAction.Insert, codec.key, action.storage.blob];
        break;
      }
      case UpdateStorageKind.Remove: {
        const codec = serialize.serviceStorage(serviceId, action.key);
        yield [StateEntryUpdateAction.Remove, codec.key, EMPTY_BLOB];
        break;
      }
      default:
        assertNever(action);
    }
  }
}

function* serializePreimages(preimages: UpdatePreimage[] | undefined, encode: EncodeFun): Generator<StateEntryUpdate> {
  for (const { action, serviceId } of preimages ?? []) {
    switch (action.kind) {
      case UpdatePreimageKind.Provide: {
        const { hash, blob } = action.preimage;
        const codec = serialize.servicePreimages(serviceId, hash);
        yield [StateEntryUpdateAction.Insert, codec.key, blob];

        if (action.slot !== null) {
          const codec2 = serialize.serviceLookupHistory(serviceId, hash, tryAsU32(blob.length));
          yield [
            StateEntryUpdateAction.Insert,
            codec2.key,
            encode(codec2.Codec, tryAsLookupHistorySlots([action.slot])),
          ];
        }
        break;
      }
      case UpdatePreimageKind.UpdateOrAdd: {
        const { hash, length, slots } = action.item;
        const codec = serialize.serviceLookupHistory(serviceId, hash, length);
        yield [StateEntryUpdateAction.Insert, codec.key, encode(codec.Codec, slots)];
        break;
      }
      case UpdatePreimageKind.Remove: {
        const { hash, length } = action;
        const codec = serialize.servicePreimages(serviceId, hash);
        yield [StateEntryUpdateAction.Remove, codec.key, EMPTY_BLOB];

        const codec2 = serialize.serviceLookupHistory(serviceId, hash, length);
        yield [StateEntryUpdateAction.Remove, codec2.key, EMPTY_BLOB];
        break;
      }
      default:
        assertNever(action);
    }
  }
}
function* serializeServiceUpdates(
  servicesUpdates: UpdateService[] | undefined,
  encode: EncodeFun,
): Generator<StateEntryUpdate> {
  for (const { action, serviceId } of servicesUpdates ?? []) {
    // new service being created or updated
    const codec = serialize.serviceData(serviceId);
    yield [StateEntryUpdateAction.Insert, codec.key, encode(codec.Codec, action.account)];

    // additional lookup history update
    if (action.kind === UpdateServiceKind.Create && action.lookupHistory !== null) {
      const { lookupHistory } = action;
      const codec2 = serialize.serviceLookupHistory(serviceId, lookupHistory.hash, lookupHistory.length);
      yield [StateEntryUpdateAction.Insert, codec2.key, encode(codec2.Codec, lookupHistory.slots)];
    }
  }
}

type EncodeFun = <T>(codec: Encode<T>, val: T) => BytesBlob;

function* serializeBasicKeys(spec: ChainSpec, update: Partial<State>) {
  function doSerialize<T>(val: T, codec: StateCodec<T>): StateEntryUpdate {
    return [StateEntryUpdateAction.Insert, codec.key, Encoder.encodeObject(codec.Codec, val, spec)];
  }

  if (update.authPools !== undefined) {
    yield doSerialize(update.authPools, serialize.authPools); // C(1)
  }

  if (update.authQueues !== undefined) {
    yield doSerialize(update.authQueues, serialize.authQueues); // C(2)
  }

  if (update.recentBlocks !== undefined) {
    yield doSerialize(update.recentBlocks, serialize.recentBlocks); // C(3)
  }

  const safroleData = getSafroleData(
    update.nextValidatorData,
    update.epochRoot,
    update.sealingKeySeries,
    update.ticketsAccumulator,
  );
  if (safroleData !== undefined) {
    yield doSerialize(safroleData, serialize.safrole); // C(4)
  }

  if (update.disputesRecords !== undefined) {
    yield doSerialize(update.disputesRecords, serialize.disputesRecords); // C(5)
  }

  if (update.entropy !== undefined) {
    yield doSerialize(update.entropy, serialize.entropy); // C(6)
  }

  if (update.designatedValidatorData !== undefined) {
    yield doSerialize(update.designatedValidatorData, serialize.designatedValidators); // C(7)
  }

  if (update.currentValidatorData !== undefined) {
    yield doSerialize(update.currentValidatorData, serialize.currentValidators); // C(8)
  }

  if (update.previousValidatorData !== undefined) {
    yield doSerialize(update.previousValidatorData, serialize.previousValidators); // C(9)
  }

  if (update.availabilityAssignment !== undefined) {
    yield doSerialize(update.availabilityAssignment, serialize.availabilityAssignment); // C(10)
  }

  if (update.timeslot !== undefined) {
    yield doSerialize(update.timeslot, serialize.timeslot); // C(11)
  }

  if (update.privilegedServices !== undefined) {
    yield doSerialize(update.privilegedServices, serialize.privilegedServices); // C(12)
  }

  if (update.statistics !== undefined) {
    yield doSerialize(update.statistics, serialize.statistics); // C(13)
  }

  if (update.accumulationQueue !== undefined) {
    yield doSerialize(update.accumulationQueue, serialize.accumulationQueue); // C(14)
  }

  if (update.recentlyAccumulated !== undefined) {
    yield doSerialize(update.recentlyAccumulated, serialize.recentlyAccumulated); // C(15)
  }
}

function getSafroleData(
  nextValidatorData: SafroleData["nextValidatorData"] | undefined,
  epochRoot: SafroleData["epochRoot"] | undefined,
  sealingKeySeries: SafroleData["sealingKeySeries"] | undefined,
  ticketsAccumulator: SafroleData["ticketsAccumulator"] | undefined,
): SafroleData | undefined {
  if (
    nextValidatorData === undefined ||
    epochRoot === undefined ||
    sealingKeySeries === undefined ||
    ticketsAccumulator === undefined
  ) {
    if ([nextValidatorData, epochRoot, sealingKeySeries, ticketsAccumulator].some((x) => x !== undefined)) {
      throw new Error("SafroleData needs to be updated all at once!");
    }
    return undefined;
  }

  return SafroleData.create({
    nextValidatorData,
    epochRoot,
    sealingKeySeries,
    ticketsAccumulator,
  });
}
