import type { CodeHash, CoreIndex, PerValidator, ServiceGas, ServiceId, TimeSlot } from "@typeberry/block";
import { W_T } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import type { U64 } from "@typeberry/numbers";
import type { AuthorizationQueue, LookupHistorySlots, PerCore, ValidatorData } from "@typeberry/state";
import type { OK, Result } from "@typeberry/utils";

/** Size of the transfer memo. */
export const TRANSFER_MEMO_BYTES = W_T;
export type TRANSFER_MEMO_BYTES = typeof TRANSFER_MEMO_BYTES;

/**
 * Possible states when checking preimage status.
 *
 * NOTE: the status number also describes how many items there is going to be
 * in the `slots/data` array.
 */
export enum PreimageStatusKind {
  /** The preimage is requested. */
  Requested = 0,
  /** The preimage is available */
  Available = 1,
  /** The preimage is unavailable. */
  Unavailable = 2,
  /** The preimage is reavailable. */
  Reavailable = 3,
}

/**
 *
 * Possible results when checking preimage status.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/117000117700
 */
export type PreimageStatus =
  | {
      status: typeof PreimageStatusKind.Requested;
    }
  | {
      status: typeof PreimageStatusKind.Available;
      data: [TimeSlot];
    }
  | {
      status: typeof PreimageStatusKind.Unavailable;
      data: [TimeSlot, TimeSlot];
    }
  | {
      status: typeof PreimageStatusKind.Reavailable;
      data: [TimeSlot, TimeSlot, TimeSlot];
    };

/** Convert model representation of lookup history into `PreimageStatus`. */
export function slotsToPreimageStatus(slots: LookupHistorySlots): PreimageStatus {
  if (slots.length === PreimageStatusKind.Requested) {
    return {
      status: PreimageStatusKind.Requested,
    };
  }

  if (slots.length === PreimageStatusKind.Available) {
    return {
      status: PreimageStatusKind.Available,
      data: [slots[0]],
    };
  }

  if (slots.length === PreimageStatusKind.Unavailable) {
    return {
      status: PreimageStatusKind.Unavailable,
      data: [slots[0], slots[1]],
    };
  }

  if (slots.length === PreimageStatusKind.Reavailable) {
    return {
      status: PreimageStatusKind.Reavailable,
      data: [slots[0], slots[1], slots[2]],
    };
  }

  throw new Error(`Invalid slots length: ${slots.length}`);
}

/** Possible error when requesting a preimage. */
export enum RequestPreimageError {
  /** The preimage is already requested. */
  AlreadyRequested = 0,
  /** The preimage is already available. */
  AlreadyAvailable = 1,
  /** The account does not have enough balance to store more preimages. */
  InsufficientFunds = 2,
}

/** Possible error when forgetting a preimage. */
export enum ForgetPreimageError {
  /** Preimage was already forgotten or does not exist. */
  NotFound = 0,
  /** The preimage hasn't expired yet. */
  NotExpired = 1,
  /** Error when updating storage utilisation info. */
  StorageUtilisationError = 2,
}

/**
 * Errors that may occur when the transfer is invoked.
 *
 * TODO [ToDr] Since I don't fully understand yet which of these
 * could be checked directly in the host call (i.e. if we will
 * have access to the service account state there) for now I keep
 * them safely in the `AccumulationPartialState` implementation.
 * However, if possible, these should be moved directly to the
 * host call implementation.
 */
export enum TransferError {
  /** The destination service does not exist. */
  DestinationNotFound = 0,
  /** The supplied gas is too low to execute `OnTransfer` entry point. */
  GasTooLow = 1,
  /** After transfering the funds account balance would be below the threshold. */
  BalanceBelowThreshold = 2,
}

/**
 * Errors that may occur when `quit` is invoked.
 *
 * Note there is partial overlap with `TransferError`, except
 * for `BalanceBelowThreshold`, since it doesn't matter,
 * because the account is removed anyway.
 */
export enum EjectError {
  /** The service does not exist or does not expect to be ejected by us. */
  InvalidService = 0,
  /** The service must have only one previous code preimage available. */
  InvalidPreimage = 1,
}

export enum ProvidePreimageError {
  /** The service does not exist. */
  ServiceNotFound = 0,
  /** The preimage wasn't requested. */
  WasNotRequested = 1,
  /** The preimage is already provided. */
  AlreadyProvided = 2,
}

export enum NewServiceError {
  /** Not enough balance to create the service account. */
  InsufficientFunds = 0,
  /** Service is not privileged to set gratis storage. */
  UnprivilegedService = 1,
  /** Registrar attempting to create a service with already existing id. */
  RegistrarServiceIdAlreadyTaken = 2,
}

export enum UpdatePrivilegesError {
  /** Service is not privileged to update privileges. */
  UnprivilegedService = 0,
  /** Provided service id is incorrect. */
  InvalidServiceId = 1,
}

/** Service is not privileged to perform an action. */
export const UnprivilegedError = Symbol("Insufficient privileges.");
export type UnprivilegedError = typeof UnprivilegedError;

/**
 * `U`: state components mutated by the accumulation.
 * - `d`: service accounts state
 * - `i`: upcoming validator keys
 * - `q`: queue of work reports
 * - `x`: priviliges state
 *
 * https://graypaper.fluffylabs.dev/#/579bd12/163602163602
 */
export interface PartialState {
  /**
   * Request (query) preimage status.
   *
   * States:
   * https://graypaper.fluffylabs.dev/#/579bd12/116f00116f00
   */
  checkPreimageStatus(hash: PreimageHash, length: U64): PreimageStatus | null;

  /**
   * Request (solicit) a preimage to be (re-)available.
   *
   * States:
   * https://graypaper.fluffylabs.dev/#/579bd12/116f00116f00
   */
  requestPreimage(hash: PreimageHash, length: U64): Result<OK, RequestPreimageError>;

  /**
   * Mark a preimage hash as unavailable (forget it).
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/335602335602
   */
  forgetPreimage(hash: PreimageHash, length: U64): Result<OK, ForgetPreimageError>;

  /**
   * Remove the provided source account and transfer the remaining account balance to current service.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/37b60137b601?v=0.6.6
   */
  eject(from: ServiceId | null, previousCode: PreimageHash): Result<OK, EjectError>;

  /**
   * Transfer given `amount` of funds to the `destination`,
   * passing `gas` fee for transfer and given `memo`.
   */
  transfer(
    destination: ServiceId | null,
    amount: U64,
    gas: ServiceGas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError>;

  /**
   * Create a new service with given codeHash, length, gas, allowance, gratisStorage and wantedServiceId.
   *
   * Returns a newly assigned id
   * or `wantedServiceId` if it's lower than `S`
   * and parent of that service is `Registrar`.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/2fa9042fc304?v=0.7.2
   *
   * An error can be returned in case the account does not
   * have the required balance
   * or tries to set gratis storage without being `Manager`
   * or `Registrar` tries to set service id thats already taken.
   */
  newService(
    codeHash: CodeHash,
    codeLength: U64,
    gas: ServiceGas,
    allowance: ServiceGas,
    gratisStorage: U64,
    wantedServiceId: U64,
  ): Result<ServiceId, NewServiceError>;

  /** Upgrade code of currently running service. */
  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void;

  /** Designate new validators given their key and meta data. */
  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): Result<OK, UnprivilegedError>;

  /**
   * Checkpoint this partial state.
   *
   * I.e. assign the "regular dimension" of the context to
   * the "exceptional dimension".
   * https://graypaper.fluffylabs.dev/#/579bd12/2df4012df401
   */
  checkpoint(): void;

  /** Update authorization queue for given core and authorize a service for this core. */
  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: AuthorizationQueue,
    assigner: ServiceId | null,
  ): Result<OK, UpdatePrivilegesError>;

  /**
   * Update priviliged services and their gas.
   *
   * `m`: manager service (can change privileged services)
   * `a`: manages authorization queue
   * `v`: manages validator keys
   * `r`: manages create new services in protected id range.
   * `z`: collection of serviceId -> gas that auto-accumulate every block
   *
   */
  updatePrivilegedServices(
    m: ServiceId | null,
    a: PerCore<ServiceId>,
    v: ServiceId | null,
    r: ServiceId | null,
    z: Map<ServiceId, ServiceGas>,
  ): Result<OK, UpdatePrivilegesError>;

  /** Yield accumulation trie result hash. */
  yield(hash: OpaqueHash): void;

  /** Provide a preimage for given service. */
  providePreimage(service: ServiceId | null, preimage: BytesBlob): Result<OK, ProvidePreimageError>;
}
