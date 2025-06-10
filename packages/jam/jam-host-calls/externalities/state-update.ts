import type { CoreIndex, PerValidator, ServiceGas, ServiceId } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import { type FixedSizeArray, asKnownSize } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import { type Service, ServiceAccountInfo, type ValidatorData } from "@typeberry/state";
import type { NewPreimage, PreimageUpdate } from "./partial-state-db.js";
import type { PendingTransfer } from "./pending-transfer.js";

/**
 * State updates that currently accumulating service produced.
 *
 * `x_u`: https://graypaper.fluffylabs.dev/#/9a08063/2f31012f3101?v=0.6.6
 */
export class StateUpdate {
  /** Create a copy of another `StateUpdate`. Used by checkpoints. */
  static copyFrom(from: StateUpdate): StateUpdate {
    const update = new StateUpdate();
    update.newServices.push(...from.newServices);
    update.ejectedServices.push(...from.ejectedServices);
    update.transfers.push(...from.transfers);
    update.lookupHistory.push(...from.lookupHistory);
    update.providedPreimages.push(...from.providedPreimages);
    for (const [k, v] of from.authorizationQueues) {
      update.authorizationQueues.set(k, v);
    }

    update.updatedServiceInfo =
      from.updatedServiceInfo === null ? null : ServiceAccountInfo.create(from.updatedServiceInfo);
    update.validatorsData = from.validatorsData === null ? null : asKnownSize([...from.validatorsData]);
    update.yieldedRoot = from.yieldedRoot;
    update.priviledgedServices =
      from.priviledgedServices === null
        ? null
        : {
            ...from.priviledgedServices,
          };

    return update;
  }

  /** Newly created services. */
  public readonly newServices: Service[] = [];
  /** Services that were successfully ejected. */
  public readonly ejectedServices: ServiceId[] = [];
  /** Pending transfers. */
  public readonly transfers: PendingTransfer[] = [];
  /** Lookup History to update preimages. */
  public readonly lookupHistory: PreimageUpdate[] = [];
  /** Newly provided preimages. */
  public readonly providedPreimages: NewPreimage[] = [];
  /** Updated authorization queues for cores. */
  public readonly authorizationQueues: Map<CoreIndex, FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>> =
    new Map();

  /** Current service updated info. */
  public updatedServiceInfo: ServiceAccountInfo | null = null;

  /** Yielded accumulation root. */
  public yieldedRoot: OpaqueHash | null = null;
  /** New validators data. */
  public validatorsData: PerValidator<ValidatorData> | null = null;
  /** Updated priviliged services. */
  public priviledgedServices: {
    manager: ServiceId;
    authorizer: ServiceId;
    validators: ServiceId;
    autoAccumulate: [ServiceId, ServiceGas][];
  } | null = null;
}
