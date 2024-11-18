import type { CodeHash, CoreIndex, ServiceId } from "@typeberry/block";
import { Q, W_T } from "@typeberry/block/gp-constants";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/safrole";
import type { Result } from "@typeberry/utils";

/** Size of the authorization queue. */
export const AUTHORIZATION_QUEUE_SIZE = Q;
export type AUTHORIZATION_QUEUE_SIZE = typeof AUTHORIZATION_QUEUE_SIZE;

/** Size of the transfer memo. */
export const TRANSFER_MEMO_BYTES = W_T;
export type TRANSFER_MEMO_BYTES = typeof TRANSFER_MEMO_BYTES;

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
 * `U`: state components mutated by the accumulation.
 * - `d`: service accounts state
 * - `i`: upcoming validator keys
 * - `q`: queue of work reports
 * - `x`: priviliges state
 *
 * https://graypaper.fluffylabs.dev/#/439ca37/161402161402
 */
export interface AccumulationPartialState {
  /**
   * Transfer given `amount` of funds to the `destination`,
   * passing `suppliedGas` to invoke `OnTransfer` entry point
   * and given `memo`.
   */
  transfer(
    destination: ServiceId,
    amount: U64,
    suppliedGas: Gas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<null, TransferError>;

  /**
   * Create a new service with requested id, codeHash, gas and balance.
   *
   * Note the assigned id might be different than requested
   * in case of a conflict.
   * https://graypaper.fluffylabs.dev/#/364735a/2b5c012b5c01
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
  updateValidatorsData(validatorsData: KnownSizeArray<ValidatorData, "ValidatorsCount">): void;

  /**
   * Checkpoint this partial state.
   *
   * I.e. assign the "regular dimension" of the context to
   * the "exceptional dimension".
   * https://graypaper.fluffylabs.dev/#/364735a/2a96022a9602
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
}
