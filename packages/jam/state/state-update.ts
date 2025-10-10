import type { ServiceId, TimeSlot } from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { BytesBlob } from "@typeberry/bytes";
import { tryAsU32, type U32 } from "@typeberry/numbers";
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
  static provide({ preimage, slot }: { preimage: PreimageItem; slot: TimeSlot | null }) {
    return new UpdatePreimage({
      kind: UpdatePreimageKind.Provide,
      preimage,
      slot,
    });
  }

  /** The preimage should be removed completely from the database. */
  static remove({ hash, length }: { hash: PreimageHash; length: U32 }) {
    return new UpdatePreimage({
      kind: UpdatePreimageKind.Remove,
      hash,
      length,
    });
  }

  /** Update the lookup history of some preimage or add a new one (request). */
  static updateOrAdd({ lookupHistory }: { lookupHistory: LookupHistoryItem }) {
    return new UpdatePreimage({
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
 * Update service info or create a new one.
 */
export class UpdateService {
  private constructor(
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

  static update({ serviceInfo }: { serviceInfo: ServiceAccountInfo }) {
    return new UpdateService({
      kind: UpdateServiceKind.Update,
      account: serviceInfo,
    });
  }

  static create({
    serviceInfo,
    lookupHistory,
  }: {
    serviceInfo: ServiceAccountInfo;
    lookupHistory: LookupHistoryItem | null;
  }) {
    return new UpdateService({
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

  static set({ storage }: { storage: StorageItem }) {
    return new UpdateStorage({ kind: UpdateStorageKind.Set, storage });
  }

  static remove({ key }: { key: StorageKey }) {
    return new UpdateStorage({ kind: UpdateStorageKind.Remove, key });
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

export type Updates = {
  /** Updates current service or create a new one. */
  service?: UpdateService;
  /** Service preimages to update and potentially lookup history */
  preimages?: UpdatePreimage[];
  /** Service storage to update. */
  storage?: UpdateStorage[];
};

export class ServicesUpdate {
  public static empty(): ServicesUpdate {
    return new ServicesUpdate(new Set(), new Map());
  }

  public static copyFrom(update: ServicesUpdate): ServicesUpdate {
    return new ServicesUpdate(new Set(update.removed), new Map(update.updated));
  }

  public removeService(id: ServiceId): void {
    this.removed.add(id);
  }

  public getService(id: ServiceId): UpdateService | undefined {
    return this.updated.get(id)?.service;
  }

  public createService(id: ServiceId, info: ServiceAccountInfo, lookupHistory: LookupHistoryItem): void {
    const serviceUpdate = this.updated.get(id);
    if (serviceUpdate === undefined) {
      this.updated.set(id, {
        service: UpdateService.create({
          serviceInfo: info,
          lookupHistory,
        }),
      });
      return;
    }
    if (serviceUpdate.service !== undefined) throw new Error(`Attempting to create duplicated service with id: ${id}`);
    this.updated.set(id, {
      ...serviceUpdate,
      service: UpdateService.create({
        serviceInfo: info,
        lookupHistory,
      }),
    });
  }

  public updateServiceInfo(id: ServiceId, info: ServiceAccountInfo): void {
    const serviceUpdate = this.updated.get(id);
    if (serviceUpdate === undefined) {
      this.updated.set(id, {
        service: UpdateService.update({
          serviceInfo: info,
        }),
      });
      return;
    }
    const service = serviceUpdate.service;
    if (service?.action.kind === UpdateServiceKind.Create) {
      this.updated.set(id, {
        ...serviceUpdate,
        service: UpdateService.create({
          serviceInfo: info,
          lookupHistory: service.action.lookupHistory,
        }),
      });
      return;
    }
    this.updated.set(id, {
      ...serviceUpdate,
      service: UpdateService.update({
        serviceInfo: info,
      }),
    });
  }

  public getPreimages(id: ServiceId): UpdatePreimage[] | undefined {
    return this.updated.get(id)?.preimages;
  }

  public updatePreimage(id: ServiceId, preimageUpdate: UpdatePreimage): void {
    const serviceUpdate = this.updated.get(id);
    if (serviceUpdate === undefined) {
      this.updated.set(id, { preimages: [preimageUpdate] });
      return;
    }
    const preimages = serviceUpdate.preimages ?? [];
    preimages.push(preimageUpdate);
    this.updated.set(id, { ...serviceUpdate, preimages });
  }

  public getStorage(id: ServiceId): UpdateStorage[] | undefined {
    return this.updated.get(id)?.storage;
  }

  public updateStorage(id: ServiceId, storageUpdate: UpdateStorage): void {
    const serviceUpdate = this.updated.get(id);
    if (serviceUpdate === undefined) {
      this.updated.set(id, { storage: [storageUpdate] });
      return;
    }

    const storage = serviceUpdate.storage ?? [];
    const index = storage.findIndex((x) => x.key.isEqualTo(storageUpdate.key));
    const count = index === -1 ? 0 : 1;
    storage.splice(index, count, storageUpdate);

    this.updated.set(id, { ...serviceUpdate, storage: storage });
  }

  private constructor(
    /** Service ids to remove from state alongside all their data. */
    public readonly removed: Set<ServiceId>,
    /** Services to update, create anew, update preimage, change storage. */
    public readonly updated: Map<ServiceId, Updates>,
  ) {}
}
