import { type CoreIndex, type PerValidator, tryAsCoreIndex } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { type FixedSizeArray, asKnownSize } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import type { PrivilegedServices, ServicesUpdate, State, ValidatorData } from "@typeberry/state";
import type { PendingTransfer } from "./pending-transfer.js";

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
  /** Yielded accumulation root. */
  public yieldedRoot: OpaqueHash | null = null;
  /** New validators data. */
  public validatorsData?: PerValidator<ValidatorData>;
  /** Updated priviliged services. */
  public privilegedServices?: PrivilegedServices;

  private constructor(
    /** Services state updates. */
    public readonly services: ServicesUpdate,
    /** Pending transfers. */
    public readonly transfers: PendingTransfer[],
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
  static new(update: ServiceStateUpdate): AccumulationStateUpdate {
    const stateUpdate = new AccumulationStateUpdate(update, []);
    stateUpdate.privilegedServices = update.privilegedServices;
    let coreIndex = 0;
    for (const v of update.authQueues ?? []) {
      stateUpdate.authorizationQueues.set(tryAsCoreIndex(coreIndex), v);
      coreIndex++;
    }

    for (
      let coreIndex = tryAsCoreIndex(0);
      coreIndex < (update.authQueues?.length ?? 0);
      coreIndex = tryAsCoreIndex(coreIndex + 1)
    ) {
      const queue = update.authQueues?.[coreIndex];
      if (queue !== undefined) {
        stateUpdate.authorizationQueues.set(coreIndex, queue);
      }
    }
    stateUpdate.validatorsData = update.designatedValidatorData;
    return stateUpdate;
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
    const update = new AccumulationStateUpdate(serviceUpdates, transfers);
    // update entries
    for (const [k, v] of from.authorizationQueues) {
      update.authorizationQueues.set(k, v);
    }
    update.yieldedRoot = from.yieldedRoot;
    update.validatorsData = from.validatorsData === undefined ? undefined : asKnownSize([...from.validatorsData]);
    update.privilegedServices =
      from.privilegedServices === undefined
        ? undefined
        : {
            ...from.privilegedServices,
          };
    return update;
  }
}
