import type { CoreIndex, PerValidator, ServiceId, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import type { BytesBlob } from "@typeberry/bytes";
import { type FixedSizeArray, asKnownSize } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import { type U64, isU32, isU64, tryAsU32 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  PrivilegedServices,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  StorageItem,
  type StorageKey,
  type UpdatePreimage,
  UpdatePreimageKind,
  UpdateService,
  UpdateServiceKind,
  UpdateStorage,
  type ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { OK, Result, assertNever, check } from "@typeberry/utils";
import type { PendingTransfer } from "./pending-transfer.js";

export const InsufficientFundsError = "insufficient funds";
export type InsufficientFundsError = typeof InsufficientFundsError;

/** Update of the state entries coming from accumulation of a single service. */
export type ServiceStateUpdate = Partial<Pick<State, "privilegedServices" | "authQueues" | "designatedValidatorData">> &
  ServicesUpdate;

/**
 * State updates that currently accumulating service produced.
 *
 * `x_u`: https://graypaper.fluffylabs.dev/#/9a08063/2f31012f3101?v=0.6.6
 */
export class AccumulationStateUpdate {
  /** Updated authorization queues for cores. */
  public readonly authorizationQueues: Map<CoreIndex, FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>> =
    new Map();
  /** New validators data. */
  public validatorsData: PerValidator<ValidatorData> | null = null;
  /** Updated priviliged services. */
  public privilegedServices: PrivilegedServices | null = null;

  private constructor(
    /** Services state updates. */
    public readonly services: ServicesUpdate,
    /** Pending transfers. */
    public readonly transfers: PendingTransfer[],
    /** Yielded accumulation root. */
    public readonly yieldedRoots: Map<ServiceId, OpaqueHash> = new Map(),
  ) {}

  /** Create new empty state update. */
  static empty(): AccumulationStateUpdate {
    return new AccumulationStateUpdate(
      {
        servicesUpdates: [],
        servicesRemoved: [],
        preimages: [],
        storage: [],
      },
      [],
    );
  }

  /** Create a state update with some existing, yet uncommited services updates. */
  static new(update: ServicesUpdate): AccumulationStateUpdate {
    return new AccumulationStateUpdate(
      {
        ...update,
      },
      [],
    );
  }

  /** Create a copy of another `StateUpdate`. Used by checkpoints. */
  static copyFrom(from: AccumulationStateUpdate): AccumulationStateUpdate {
    const serviceUpdates: ServicesUpdate = {
      servicesUpdates: [...from.services.servicesUpdates],
      servicesRemoved: [...from.services.servicesRemoved],
      preimages: [...from.services.preimages],
      storage: [...from.services.storage],
    };
    const transfers = [...from.transfers];
    const update = new AccumulationStateUpdate(serviceUpdates, transfers, new Map(from.yieldedRoots));

    // update entries
    for (const [k, v] of from.authorizationQueues) {
      update.authorizationQueues.set(k, v);
    }

    if (from.validatorsData !== null) {
      update.validatorsData = asKnownSize([...from.validatorsData]);
    }

    if (from.privilegedServices !== null) {
      update.privilegedServices = PrivilegedServices.create({
        ...from.privilegedServices,
        authManager: asKnownSize([...from.privilegedServices.authManager]),
      });
    }
    return update;
  }
}

type StateSlice = Pick<State, "getService" | "privilegedServices">;

export class PartiallyUpdatedState<T extends StateSlice = StateSlice> {
  /** A collection of state updates. */
  public readonly stateUpdate;

  constructor(
    /** Original (unmodified state). */
    public readonly state: T,
    stateUpdate?: AccumulationStateUpdate,
  ) {
    this.stateUpdate =
      stateUpdate === undefined ? AccumulationStateUpdate.empty() : AccumulationStateUpdate.copyFrom(stateUpdate);
  }

  /**
   * Retrieve info of service with given id.
   *
   * NOTE the info may be updated compared to what is in the state.
   *
   * Takes into account newly created services as well.
   */
  getServiceInfo(destination: ServiceId | null): ServiceAccountInfo | null {
    if (destination === null) {
      return null;
    }

    const isEjected = this.stateUpdate.services.servicesRemoved.some((x) => x === destination);
    if (isEjected) {
      return null;
    }

    const maybeNewService = this.stateUpdate.services.servicesUpdates.find(
      (update) => update.serviceId === destination,
    );

    if (maybeNewService !== undefined) {
      return maybeNewService.action.account;
    }

    const maybeService = this.state.getService(destination);
    if (maybeService === null) {
      return null;
    }

    return maybeService.getInfo();
  }

  getStorage(serviceId: ServiceId, rawKey: StorageKey): BytesBlob | null {
    const item = this.stateUpdate.services.storage.find((x) => x.serviceId === serviceId && x.key.isEqualTo(rawKey));
    if (item !== undefined) {
      return item.value;
    }

    const service = this.state.getService(serviceId);
    return service?.getStorage(rawKey) ?? null;
  }

  /**
   * Returns `true` if the preimage is already provided either in current
   * accumulation scope or earlier.
   *
   * NOTE: Does not check if the preimage is available, we just check
   * the existence in `preimages` map.
   */
  hasPreimage(serviceId: ServiceId, hash: PreimageHash): boolean {
    const providedPreimage = this.stateUpdate.services.preimages.find(
      // we ignore the action here, since if there is <any> update on that
      // hash it means it has to exist, right?
      (p) => p.serviceId === serviceId && p.hash.isEqualTo(hash),
    );
    if (providedPreimage !== undefined) {
      return true;
    }

    // fallback to state preimages
    const service = this.state.getService(serviceId);
    if (service === undefined) {
      return false;
    }

    return service?.hasPreimage(hash) ?? false;
  }

  getPreimage(serviceId: ServiceId, hash: PreimageHash): BytesBlob | null {
    // TODO [ToDr] Should we verify availability here?
    const freshlyProvided = this.stateUpdate.services.preimages.find(
      (x) => x.serviceId === serviceId && x.hash.isEqualTo(hash),
    );
    if (freshlyProvided !== undefined && freshlyProvided.action.kind === UpdatePreimageKind.Provide) {
      return freshlyProvided.action.preimage.blob;
    }

    const service = this.state.getService(serviceId);
    return service?.getPreimage(hash) ?? null;
  }

  /** Get status of a preimage of current service taking into account any updates. */
  getLookupHistory(
    currentTimeslot: TimeSlot,
    serviceId: ServiceId,
    hash: PreimageHash,
    length: U64,
  ): LookupHistoryItem | null {
    // TODO [ToDr] This is most likely wrong. We may have `provide` and `remove` within
    // the same state update. We should however switch to proper "updated state"
    // representation soon.
    const updatedPreimage = this.stateUpdate.services.preimages.findLast(
      (update) => update.serviceId === serviceId && update.hash.isEqualTo(hash) && BigInt(update.length) === length,
    );

    const stateFallback = () => {
      // fallback to state lookup
      const service = this.state.getService(serviceId);
      const lenU32 = preimageLenAsU32(length);
      if (lenU32 === null || service === null) {
        return null;
      }

      const slots = service.getLookupHistory(hash, lenU32);
      return slots === null ? null : new LookupHistoryItem(hash, lenU32, slots);
    };

    if (updatedPreimage === undefined) {
      return stateFallback();
    }

    const { action } = updatedPreimage;
    switch (action.kind) {
      case UpdatePreimageKind.Provide: {
        // casting to U32 is safe, since we compare with object we have in memory.
        return new LookupHistoryItem(hash, updatedPreimage.length, tryAsLookupHistorySlots([currentTimeslot]));
      }
      case UpdatePreimageKind.Remove: {
        const state = stateFallback();
        // kinda impossible, since we know it's there because it's removed.
        if (state === null) {
          return null;
        }

        return new LookupHistoryItem(hash, state.length, tryAsLookupHistorySlots([...state.slots, currentTimeslot]));
      }
      case UpdatePreimageKind.UpdateOrAdd: {
        return action.item;
      }
    }

    assertNever(action);
  }

  /* State update functions. */

  updateStorage(serviceId: ServiceId, key: StorageKey, value: BytesBlob | null) {
    const update =
      value === null
        ? UpdateStorage.remove({ serviceId, key })
        : UpdateStorage.set({
            serviceId,
            storage: StorageItem.create({ key, value }),
          });

    const index = this.stateUpdate.services.storage.findIndex(
      (x) => x.serviceId === update.serviceId && x.key.isEqualTo(key),
    );
    const count = index === -1 ? 0 : 1;
    this.stateUpdate.services.storage.splice(index, count, update);
  }

  /**
   * Update a preimage.
   *
   * Note we store all previous entries as well, since there might be a sequence of:
   * `provide` -> `remove` and both should update the end state somehow.
   */
  updatePreimage(newUpdate: UpdatePreimage) {
    this.stateUpdate.services.preimages.push(newUpdate);
  }

  updateServiceStorageUtilisation(
    serviceId: ServiceId,
    items: number,
    bytes: bigint,
    serviceInfo: ServiceAccountInfo,
  ): Result<OK, InsufficientFundsError> {
    check(items >= 0, `storageUtilisationCount has to be a positive number, got: ${items}`);
    check(bytes >= 0, `storageUtilisationBytes has to be a positive number, got: ${bytes}`);

    const overflowItems = !isU32(items);
    const overflowBytes = !isU64(bytes);

    // TODO [ToDr] this is not specified in GP, but it seems sensible.
    if (overflowItems || overflowBytes) {
      return Result.error(InsufficientFundsError);
    }

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(items, bytes, serviceInfo.gratisStorage);
    if (serviceInfo.balance < thresholdBalance) {
      return Result.error(InsufficientFundsError);
    }

    // Update service info with new details.
    this.updateServiceInfo(
      serviceId,
      ServiceAccountInfo.create({
        ...serviceInfo,
        storageUtilisationBytes: bytes,
        storageUtilisationCount: items,
      }),
    );
    return Result.ok(OK);
  }

  updateServiceInfo(serviceId: ServiceId, newInfo: ServiceAccountInfo) {
    const idx = this.stateUpdate.services.servicesUpdates.findIndex((x) => x.serviceId === serviceId);
    const toRemove = idx === -1 ? 0 : 1;
    const existingItem = this.stateUpdate.services.servicesUpdates[idx];

    if (existingItem?.action.kind === UpdateServiceKind.Create) {
      this.stateUpdate.services.servicesUpdates.splice(
        idx,
        toRemove,
        UpdateService.create({
          serviceId,
          serviceInfo: newInfo,
          lookupHistory: existingItem.action.lookupHistory,
        }),
      );

      return;
    }

    this.stateUpdate.services.servicesUpdates.splice(
      idx,
      toRemove,
      UpdateService.update({
        serviceId,
        serviceInfo: newInfo,
      }),
    );
  }

  getPrivilegedServices() {
    if (this.stateUpdate.privilegedServices !== null) {
      return this.stateUpdate.privilegedServices;
    }

    return this.state.privilegedServices;
  }
}

function preimageLenAsU32(length: U64) {
  // Safe to convert to Number and U32: we check that len < 2^32 before conversion
  return length >= 2n ** 32n ? null : tryAsU32(Number(length));
}
