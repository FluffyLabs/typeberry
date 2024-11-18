import type { CodeHash, CoreIndex, ServiceId } from "@typeberry/block";
import { Q } from "@typeberry/block/gp-constants";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/safrole";
import type { Result } from "@typeberry/utils";

/** Size of the authorization queue. */
export const AUTHORIZATION_QUEUE_SIZE = Q;
export type AUTHORIZATION_QUEUE_SIZE = typeof AUTHORIZATION_QUEUE_SIZE;

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
   * Request (solicit) a preimage to be (re-)available.
   *
   * States:
   * https://graypaper.fluffylabs.dev/#/364735a/113000113000
   */
  requestPreimage(hash: OpaqueHash, length: U32): Result<null, RequestPreimageError>;

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
