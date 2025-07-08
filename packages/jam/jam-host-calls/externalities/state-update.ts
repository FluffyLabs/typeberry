import type { CoreIndex, PerValidator, ServiceGas, ServiceId, TimeSlot } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { type FixedSizeArray, asKnownSize } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import {
  type InMemoryService,
  LookupHistoryItem,
  type PreimageItem,
  ServiceAccountInfo,
  type ServicesUpdate,
  UpdatePreimage,
  UpdateService,
  type UpdateStorage,
  type ValidatorData,
} from "@typeberry/state";
import type { PendingTransfer } from "./pending-transfer.js";

/**
 * State updates that currently accumulating service produced.
 *
 * `x_u`: https://graypaper.fluffylabs.dev/#/9a08063/2f31012f3101?v=0.6.6
 */
export class AccumulationStateUpdate {
  /** Create a copy of another `StateUpdate`. Used by checkpoints. */
  static copyFrom(from: AccumulationStateUpdate): AccumulationStateUpdate {
    const update = new AccumulationStateUpdate(from.serviceId);
    update.newServices.push(...from.newServices);
    update.ejectedServices.push(...from.ejectedServices);
    update.transfers.push(...from.transfers);
    update.lookupHistory.push(...from.lookupHistory);
    update.providedPreimages.push(...from.providedPreimages);
    for (const [k, v] of from.authorizationQueues) {
      update.authorizationQueues.set(k, v);
    }
    update.storage.push(...from.storage);

    update.updatedServiceInfo =
      from.updatedServiceInfo === null ? null : ServiceAccountInfo.create(from.updatedServiceInfo);
    update.validatorsData = from.validatorsData === null ? null : asKnownSize([...from.validatorsData]);
    update.yieldedRoot = from.yieldedRoot;
    update.privilegedServices =
      from.privilegedServices === null
        ? null
        : {
            ...from.privilegedServices,
          };
    return update;
  }

  // TODO [ToDr] Ideally we would use `ServicesUpdate`-format already.
  public intoServicesUpdate(timeslot: TimeSlot): ServicesUpdate {
    return {
      servicesRemoved: this.ejectedServices,
      servicesUpdates: this.newServices
        .map((s) => {
          return UpdateService.create({
            serviceId: s.serviceId,
            serviceInfo: s.data.info,
            lookupHistory: s.data.lookupHistory.values().next().value?.[0] ?? null,
          });
        })
        .concat(
          this.updatedServiceInfo === null
            ? []
            : [
                UpdateService.update({
                  serviceId: this.serviceId,
                  serviceInfo: this.updatedServiceInfo,
                }),
              ],
        ),
      preimages: this.providedPreimages
        .map((p) => {
          return UpdatePreimage.provide({
            serviceId: p.serviceId,
            preimage: p.item,
            slot: timeslot,
          });
        })
        .concat(
          this.lookupHistory.map((x) => {
            if (x.forgotten) {
              return UpdatePreimage.remove({
                serviceId: this.serviceId,
                hash: x.hash,
                length: x.length,
              });
            }
            return UpdatePreimage.updateOrAdd({
              serviceId: this.serviceId,
              lookupHistory: x,
            });
          }),
        ),
      storage: this.storage,
    };
  }

  /** Newly created services. */
  public readonly newServices: InMemoryService[] = [];
  /** Services that were successfully ejected. */
  public readonly ejectedServices: ServiceId[] = [];
  /** Pending transfers. */
  public readonly transfers: PendingTransfer[] = [];
  /** Lookup History to update preimages. */
  public readonly lookupHistory: PreimageUpdate[] = [];
  /** Newly provided preimages. */
  public readonly providedPreimages: NewPreimage[] = [];
  /** Updated authorization queues for cores. */
  public readonly authorizationQueues: Map<CoreIndex, FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>> =
    new Map();

  /** Current service updated info. */
  public updatedServiceInfo: ServiceAccountInfo | null = null;

  /** Yielded accumulation root. */
  public yieldedRoot: OpaqueHash | null = null;
  /** New validators data. */
  public validatorsData: PerValidator<ValidatorData> | null = null;
  /** Updated priviliged services. */
  public privilegedServices: {
    manager: ServiceId;
    authorizer: ServiceId;
    validators: ServiceId;
    autoAccumulate: [ServiceId, ServiceGas][];
  } | null = null;

  /** Service's storage update. */
  public storage: UpdateStorage[] = [];

  constructor(public readonly serviceId: ServiceId) {}
}

export class PreimageUpdate extends LookupHistoryItem {
  private constructor(
    item: LookupHistoryItem,
    /** NOTE: Forgotten preimages should be removed along their lookup history. */
    public forgotten: boolean,
  ) {
    super(item.hash, item.length, item.slots);
  }

  static forget(item: LookupHistoryItem) {
    return new PreimageUpdate(item, true);
  }

  static update(item: LookupHistoryItem) {
    return new PreimageUpdate(item, false);
  }
}

export class NewPreimage {
  public static create({
    serviceId,
    item,
  }: {
    serviceId: ServiceId;
    item: PreimageItem;
  }): NewPreimage {
    return new NewPreimage(serviceId, item);
  }

  private constructor(
    public readonly serviceId: ServiceId,
    public readonly item: PreimageItem,
  ) {}
}
