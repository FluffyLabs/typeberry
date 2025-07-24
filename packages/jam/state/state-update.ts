import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { assertNever } from "@typeberry/utils";
import type { LookupHistoryItem, PreimageItem, ServiceAccountInfo, StorageItem, StorageKey } from "./service.js";

export enum UpdatePreimageKind {
  /** Insert new preimage and optionally update it's lookup history. */
  Provide = 0,
  /** Remove a preimage and it's lookup history. */
  Remove = 1,
  /** update or add lookup history for preimage hash/len to given value. */
  UpdateOrAdd = 2,
}
/**
 * A preimage update.
 *
 * Can be one of the following cases:
 * 1. Provide a new preimage blob and set the lookup history to available at `slot`.
 * 2. Remove (expunge) a preimage and it's lookup history.
 * 3. Update `LookupHistory` with given value.
 */
export class UpdatePreimage {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly action:
      | {
          kind: UpdatePreimageKind.Provide;
          preimage: PreimageItem;
          // optionally set lookup history of that preimage to "available"
          slot: TimeSlot | null;
        }
      | {
          kind: UpdatePreimageKind.Remove;
          hash: PreimageHash;
          length: U32;
        }
      | {
          kind: UpdatePreimageKind.UpdateOrAdd;
          item: LookupHistoryItem;
        },
  ) {}

  /** A preimage is provided. We should update the lookuphistory and add the preimage to db. */
  static provide({
    serviceId,
    preimage,
    slot,
  }: { serviceId: ServiceId; preimage: PreimageItem; slot: TimeSlot | null }) {
    return new UpdatePreimage(serviceId, {
      kind: UpdatePreimageKind.Provide,
      preimage,
      slot,
    });
  }

  /** The preimage should be removed completely from the database. */
  static remove({ serviceId, hash, length }: { serviceId: ServiceId; hash: PreimageHash; length: U32 }) {
    return new UpdatePreimage(serviceId, {
      kind: UpdatePreimageKind.Remove,
      hash,
      length,
    });
  }

  /** Update the lookup history of some preimage or add a new one (request). */
  static updateOrAdd({ serviceId, lookupHistory }: { serviceId: ServiceId; lookupHistory: LookupHistoryItem }) {
    return new UpdatePreimage(serviceId, {
      kind: UpdatePreimageKind.UpdateOrAdd,
      item: lookupHistory,
    });
  }

  get hash(): PreimageHash {
    switch (this.action.kind) {
      case UpdatePreimageKind.Provide:
        return this.action.preimage.hash;
      case UpdatePreimageKind.Remove:
        return this.action.hash;
      case UpdatePreimageKind.UpdateOrAdd:
        return this.action.item.hash;
    }
    throw assertNever(this.action);
  }

  get length(): U32 {
    switch (this.action.kind) {
      case UpdatePreimageKind.Provide:
        return tryAsU32(this.action.preimage.blob.length);
      case UpdatePreimageKind.Remove:
        return this.action.length;
      case UpdatePreimageKind.UpdateOrAdd:
        return this.action.item.length;
    }
    throw assertNever(this.action);
  }
}

/** The type of service update. */
export enum UpdateServiceKind {
  /** Just update the `ServiceAccountInfo`. */
  Update = 0,
  /** Create a new `Service` instance. */
  Create = 1,
}
/**
 * Update service info of a particular `ServiceId` or create a new one.
 */
export class UpdateService {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly action:
      | {
          kind: UpdateServiceKind.Update;
          account: ServiceAccountInfo;
        }
      | {
          kind: UpdateServiceKind.Create;
          account: ServiceAccountInfo;
          lookupHistory: LookupHistoryItem | null;
        },
  ) {}

  static update({ serviceId, serviceInfo }: { serviceId: ServiceId; serviceInfo: ServiceAccountInfo }) {
    return new UpdateService(serviceId, {
      kind: UpdateServiceKind.Update,
      account: serviceInfo,
    });
  }

  static create({
    serviceId,
    serviceInfo,
    lookupHistory,
  }: { serviceId: ServiceId; serviceInfo: ServiceAccountInfo; lookupHistory: LookupHistoryItem | null }) {
    return new UpdateService(serviceId, {
      kind: UpdateServiceKind.Create,
      account: serviceInfo,
      lookupHistory,
    });
  }
}

/** Update service storage kind. */
export enum UpdateStorageKind {
  /** Set a storage value. */
  Set = 0,
  /** Remove a storage value. */
  Remove = 1,
}
/**
 * Update service storage item.
 *
 * Can either create/modify an entry or remove it.
 */
export class UpdateStorage {
  private constructor(
    public readonly serviceId: ServiceId,
    public readonly action:
      | {
          kind: UpdateStorageKind.Set;
          storage: StorageItem;
        }
      | {
          kind: UpdateStorageKind.Remove;
          key: StorageKey;
        },
  ) {}

  static set({ serviceId, storage }: { serviceId: ServiceId; storage: StorageItem }) {
    return new UpdateStorage(serviceId, { kind: UpdateStorageKind.Set, storage });
  }

  static remove({ serviceId, key }: { serviceId: ServiceId; key: StorageKey }) {
    return new UpdateStorage(serviceId, { kind: UpdateStorageKind.Remove, key });
  }

  get key() {
    if (this.action.kind === UpdateStorageKind.Remove) {
      return this.action.key;
    }
    return this.action.storage.key;
  }

  get value(): BytesBlob | null {
    if (this.action.kind === UpdateStorageKind.Remove) {
      return null;
    }
    return this.action.storage.value;
  }
}

// TODO [ToDr] This would be more convenient to use if the data was grouped by `ServiceId`.
export type ServicesUpdate = {
  /** Service ids to remove from state alongside all their data. */
  servicesRemoved: ServiceId[];
  /** Services to update or create anew. */
  servicesUpdates: UpdateService[];
  /** Service preimages to update and potentially lookup history */
  preimages: UpdatePreimage[];
  /** Service storage to update. */
  storage: UpdateStorage[];
};
