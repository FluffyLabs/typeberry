import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { U32 } from "@typeberry/numbers";
import type { LookupHistoryItem, PreimageItem, ServiceAccountInfo, StorageItem, StorageKey } from "./service";

/**
 * A preimage update.
 *
 * Can be one of the following cases:
 * 1. Provide a new preimage blob and set the lookup history to available at `slot`.
 * 2. Remove (expunge) a preimage and it's lookup history.
 * 3. Update `LookupHistory` with given value.
 */
export class PreimageUpdate {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly kind:
      | {
          // add new preimage
          set: PreimageItem;
          // optionally set lookup history of that preimage to "available"
          slot: TimeSlot | null;
        }
      | {
          // remove given preimage and it's lookup history.
          remove: PreimageHash;
          length: U32;
        }
      | {
          // update lookup history for given preimage to given value.
          update: LookupHistoryItem;
        },
  ) {}

  static provide({
    serviceId,
    preimage,
    slot,
  }: { serviceId: ServiceId; preimage: PreimageItem; slot: TimeSlot | null }) {
    return new PreimageUpdate(serviceId, {
      set: preimage,
      slot,
    });
  }

  static remove({ serviceId, hash, length }: { serviceId: ServiceId; hash: PreimageHash; length: U32 }) {
    return new PreimageUpdate(serviceId, {
      remove: hash,
      length,
    });
  }

  static updateOrAdd({ serviceId, lookupHistory }: { serviceId: ServiceId; lookupHistory: LookupHistoryItem }) {
    return new PreimageUpdate(serviceId, {
      update: lookupHistory,
    });
  }
}

/**
 * Update service info of a particular `ServiceId` or create a new one.
 */
export class UpdateService {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly action:
      | {
          update: ServiceAccountInfo;
        }
      | {
          create: ServiceAccountInfo;
          lookupHistory: LookupHistoryItem[];
        },
  ) {}

  static update({ serviceId, serviceInfo }: { serviceId: ServiceId; serviceInfo: ServiceAccountInfo }) {
    return new UpdateService(serviceId, {
      update: serviceInfo,
    });
  }

  static create({
    serviceId,
    serviceInfo,
    lookupHistory,
  }: { serviceId: ServiceId; serviceInfo: ServiceAccountInfo; lookupHistory: LookupHistoryItem[] }) {
    return new UpdateService(serviceId, {
      create: serviceInfo,
      lookupHistory,
    });
  }
}

/**
 * Update service storage item.
 *
 * Can either create/modify an entry or remove it.
 */
export class UpdateStorage {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly storage:
      | {
          set: StorageItem;
        }
      | {
          remove: StorageKey;
        },
  ) {}

  static set({ serviceId, storage }: { serviceId: ServiceId; storage: StorageItem }) {
    return new UpdateStorage(serviceId, { set: storage });
  }

  static remove({ serviceId, key }: { serviceId: ServiceId; key: StorageKey }) {
    return new UpdateStorage(serviceId, { remove: key });
  }
}

export type ServicesUpdate = {
  /** Service ids to remove from state alongside all their data. */
  servicesRemoved: ServiceId[];
  /** Services to update or create anew. */
  servicesUpdates: UpdateService[];
  /** Service preimages to update and potentially lookup history */
  preimages: PreimageUpdate[];
  /** Service storage to update. */
  storage: UpdateStorage[];
};

/** An update to the State object. */
export class StateUpdate<PartialState> {
  private constructor(public readonly update: Partial<PartialState>) {}

  static new<V>(update: Partial<V>) {
    return new StateUpdate(update);
  }
}

/**
 * Returns a materialized version of the state, created by copying all properties
 * from the current state and applying the update.
 *
 * NOTE: avoid using directly, since we would rather use a more backend-specific
 *       solution (i.e. only updating some fields in the database).
 */
export function copyAndUpdateState<T>(state: T, update: StateUpdate<T>): T {
  return {
    ...state,
    ...update.update,
  };
}
