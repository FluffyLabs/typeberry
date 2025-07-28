import type { CoreIndex, PerValidator } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { type FixedSizeArray, asKnownSize } from "@typeberry/collections";
import type { OpaqueHash } from "@typeberry/hash";
import { PrivilegedServices, type ServicesUpdate, type State, type ValidatorData } from "@typeberry/state";
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
  public validatorsData: PerValidator<ValidatorData> | null = null;
  /** Updated priviliged services. */
  public privilegedServices: PrivilegedServices | null = null;

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
  static new(update: ServicesUpdate): AccumulationStateUpdate {
    return new AccumulationStateUpdate(update, []);
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
    update.validatorsData = from.validatorsData === null ? null : asKnownSize([...from.validatorsData]);
    update.privilegedServices =
      from.privilegedServices === null
        ? null
        : PrivilegedServices.create({
            ...from.privilegedServices,
            authManager: asKnownSize([...from.privilegedServices.authManager]),
          });
    return update;
  }
}
