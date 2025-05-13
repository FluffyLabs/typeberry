import type { CodeHash, CoreIndex, PerValidator, ServiceId, TimeSlot } from "@typeberry/block";
import { type AUTHORIZATION_QUEUE_SIZE, W_T } from "@typeberry/block/gp-constants";
import {PreimageHash} from "@typeberry/block/preimage";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { LookupHistorySlots, ValidatorData } from "@typeberry/state";
import type { OK, Result } from "@typeberry/utils";

/** Size of the transfer memo. */
export const TRANSFER_MEMO_BYTES = W_T;
export type TRANSFER_MEMO_BYTES = typeof TRANSFER_MEMO_BYTES;

/** Possible states when checking preimage status. */
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
  if (slots.length === 0) {
    return {
      status: PreimageStatusKind.Requested,
    };
  }

  if (slots.length === 1) {
    return {
      status: PreimageStatusKind.Available,
      data: [slots[0]],
    };
  }

  if (slots.length === 2) {
    return {
      status: PreimageStatusKind.Unavailable,
      data: [slots[0], slots[1]],
    };
  }

  if (slots.length === 3) {
    return {
      status: PreimageStatusKind.Reavailable,
      data: [slots[0], slots[1], slots[2]],
    };
  }
  throw new Error(`Invalid slots length: ${slots.length}`)
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
export enum QuitError {
  /** The destination service does not exist. */
  DestinationNotFound = 0,
  /** The supplied gas is too low to execute `OnTransfer` entry point. */
  GasTooLow = 1,
}

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
  requestPreimage(hash: PreimageHash, length: U64): Result<null, RequestPreimageError>;

  /**
   * Mark a preimage hash as unavailable (forget it).
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/335602335602
   */
  forgetPreimage(hash: PreimageHash, length: U64): Result<null, null>;

  /**
   * Remove current service account and transfer all remaining
   * funds to the destination account (i.e. invoke transfer).
   *
   * `a`: amount to transfer = balance - threshold + B_S: basic minimum balance
   */
  quitAndTransfer(destination: ServiceId, suppliedGas: Gas, memo: Bytes<TRANSFER_MEMO_BYTES>): Result<null, QuitError>;

  /**
   * Remove current service account and burn the remaining funds.
   */
  quitAndBurn(): void;

  /**
   * Transfer given `amount` of funds to the `destination`,
   * passing `suppliedGas` to invoke `OnTransfer` entry point
   * and given `memo`.
   *
   * TODO [ToDr] is it possible to transfer to self?
   */
  transfer(
    destination: ServiceId | null,
    amount: U64,
    suppliedGas: Gas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError>;

  /**
   * Create a new service with requested id, codeHash, gas and balance.
   *
   * Note the assigned id might be different than requested
   * in case of a conflict.
   * https://graypaper.fluffylabs.dev/#/579bd12/2e14012e1401
   *
   * An error can be returned in case the account does not
   * have the required balance.
   */
  newService(
    requestedServiceId: ServiceId,
    codeHash: CodeHash,
    codeLength: U32,
    gas: U64,
    balance: U64,
  ): Result<ServiceId, "insufficient funds">;

  /** Upgrade code of currently running service. */
  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void;

  /** Designate new validators given their key and meta data. */
  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): void;

  /**
   * Checkpoint this partial state.
   *
   * I.e. assign the "regular dimension" of the context to
   * the "exceptional dimension".
   * https://graypaper.fluffylabs.dev/#/579bd12/2df4012df401
   */
  checkpoint(): void;

  /** Update authorization queue for given core. */
  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>,
  ): void;

  /**
   * Update priviliged services and their gas.
   *
   * `m`: manager service (can change priviledged services)
   * `a`: manages authorization queue
   * `v`: manages validator keys
   * `g`: dictionary of serviceId -> gas that auto-accumulate every block
   *
   */
  updatePrivilegedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, Gas>): void;

  /**
   * Yield accumulation trie result hash.
   *
   * https://graypaper.fluffylabs.dev/#/85129da/3f98003f9b00?v=0.6.3
   */
  yield(hash: OpaqueHash): void;
}
