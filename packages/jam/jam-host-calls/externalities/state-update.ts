import type { CoreIndex, PerValidator, ServiceId, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { BytesBlob } from "@typeberry/bytes";
import { asKnownSize, type FixedSizeArray } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import { isU32, isU64, tryAsU32, type U64 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  PrivilegedServices,
  ServiceAccountInfo,
  type ServicesUpdate,
  type State,
  StorageItem,
  type StorageKey,
  tryAsLookupHistorySlots,
  type UpdatePreimage,
  UpdatePreimageKind,
  UpdateService,
  UpdateServiceKind,
  UpdateStorage,
  type ValidatorData,
} from "@typeberry/state";
import { assertNever, check, OK, Result } from "@typeberry/utils";
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
        servicesUpdates: new Map(),
        servicesRemoved: new Set(),
        preimages: new Map(),
        storage: new Map(),
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
    const cloneMap = <A, B>(m: Map<A, B>): Map<A, B> => {
      const a: [A, B][] = [];
      for (const [key, value] of m.entries()) {
        a.push([key, value]);
      }
      return new Map(a);
    };
    const cloneMapWithArray = <A, B>(m: Map<A, B[]>): Map<A, B[]> => {
      const a: [A, B[]][] = [];
      for (const [key, value] of m.entries()) {
        a.push([key, value.slice()]);
      }
      return new Map(a);
    };
    const serviceUpdates: ServicesUpdate = {
      servicesUpdates: cloneMap(from.services.servicesUpdates),
      servicesRemoved: new Set(from.services.servicesRemoved),
      preimages: cloneMapWithArray(from.services.preimages),
      storage: cloneMapWithArray(from.services.storage),
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
        assigners: asKnownSize([...from.privilegedServices.assigners]),
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
   * Takes into account ejected and newly created services as well.
   */
  getServiceInfo(destination: ServiceId | null): ServiceAccountInfo | null {
    if (destination === null) {
      return null;
    }

    const maybeNewService = this.stateUpdate.services.servicesUpdates.get(destination);

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
    const storages = this.stateUpdate.services.storage.get(serviceId) ?? [];
    const item = storages.find((x) => x.key.isEqualTo(rawKey));
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
    const preimages = this.stateUpdate.services.preimages.get(serviceId) ?? [];
    const providedPreimage = preimages.find(
      // we ignore the action here, since if there is <any> update on that
      // hash it means it has to exist, right?
      (p) => p.hash.isEqualTo(hash),
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
    const preimages = this.stateUpdate.services.preimages.get(serviceId) ?? [];
    const freshlyProvided = preimages.find((x) => x.hash.isEqualTo(hash));
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
    const preimages = this.stateUpdate.services.preimages.get(serviceId) ?? [];
    // TODO [ToDr] This is most likely wrong. We may have `provide` and `remove` within
    // the same state update. We should however switch to proper "updated state"
    // representation soon.
    const updatedPreimage = preimages.findLast(
      (update) => update.hash.isEqualTo(hash) && BigInt(update.length) === length,
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
        ? UpdateStorage.remove({ key })
        : UpdateStorage.set({
            storage: StorageItem.create({ key, value }),
          });

    const storages = this.stateUpdate.services.storage.get(serviceId) ?? [];
    const index = storages.findIndex((x) => x.key.isEqualTo(key));
    const count = index === -1 ? 0 : 1;
    storages.splice(index, count, update);
    this.stateUpdate.services.storage.set(serviceId, storages);
  }

  /**
   * Update a preimage.
   *
   * Note we store all previous entries as well, since there might be a sequence of:
   * `provide` -> `remove` and both should update the end state somehow.
   */
  updatePreimage(serviceId: ServiceId, newUpdate: UpdatePreimage) {
    const updatePreimages = this.stateUpdate.services.preimages.get(serviceId) ?? [];
    updatePreimages.push(newUpdate);
    this.stateUpdate.services.preimages.set(serviceId, updatePreimages);
  }

  updateServiceStorageUtilisation(
    serviceId: ServiceId,
    items: number,
    bytes: bigint,
    serviceInfo: ServiceAccountInfo,
  ): Result<OK, InsufficientFundsError> {
    check`${items >= 0} storageUtilisationCount has to be a positive number, got: ${items}`;
    check`${bytes >= 0} storageUtilisationBytes has to be a positive number, got: ${bytes}`;

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
    const existingUpdate = this.stateUpdate.services.servicesUpdates.get(serviceId);

    if (existingUpdate?.action.kind === UpdateServiceKind.Create) {
      this.stateUpdate.services.servicesUpdates.set(
        serviceId,
        UpdateService.create({
          serviceInfo: newInfo,
          lookupHistory: existingUpdate.action.lookupHistory,
        }),
      );
      return;
    }

    this.stateUpdate.services.servicesUpdates.set(
      serviceId,
      UpdateService.update({
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
