/**
 * Estimated number of validators.
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 */
export const EST_VALIDATORS = 1023;
/**
 * Estimated number of super majority of validators.
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 */
export const EST_VALIDATORS_SUPER_MAJORITY = 683;
/**
 * Estimated number of cores.
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 */
export const EST_CORES = 12;
/**
 * Estimated epoch length (in time slots).
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 */
export const EST_EPOCH_LENGTH = 600;

/**
 * Additional data that has to be passed to the codec to correctly parse incoming bytes.
 *
 * TODO [ToDr] note this will most likely depend on the state of the blockchain,
 * current values are there just for the tests.
 */
export class CodecContext {
  /** Number of validators. */
  validatorsCount = 6;
  /** 2/3 of number of validators + 1 */
  validatorsSuperMajority = 5;
  /** Length of the epoch in time slots. */
  epochLength = 12;
  /** Number of cores. */
  coresCount = 2;
}
