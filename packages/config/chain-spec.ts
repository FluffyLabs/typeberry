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
 */
// TODO [ToDr] WithDebug
export class ChainSpec {
  /** Number of validators. */
  readonly validatorsCount: number;
  /** 1/3 of number of validators */
  readonly thirdOfValidators: number;
  /** 2/3 of number of validators + 1 */
  readonly validatorsSuperMajority: number;
  /** Number of cores. */
  readonly coresCount: number;
  /** Duration of a timeslot in seconds. */
  readonly slotDuration: number;
  /** Length of the epoch in time slots. */
  readonly epochLength: number;
  /** Length of the ticket contest in time slots. */
  readonly contestLength: number;
  /** The maximum number of tickets each validator can submit. */
  readonly ticketsPerValidator: number;

  constructor(data: Omit<ChainSpec, "validatorsSuperMajority" | "thirdOfValidators">) {
    this.validatorsCount = data.validatorsCount;
    this.thirdOfValidators = Math.floor(data.validatorsCount / 3);
    this.validatorsSuperMajority = Math.floor(data.validatorsCount / 3) * 2 + 1;
    this.coresCount = data.coresCount;
    this.slotDuration = data.slotDuration;
    this.epochLength = data.epochLength;
    this.contestLength = data.contestLength;
    this.ticketsPerValidator = data.ticketsPerValidator;
  }

  toString() {
    return JSON.stringify(this, null, 2);
  }
}

/** Set of values for "tiny" chain as defined in JAM test vectors. */
export const tinyChainSpec = new ChainSpec({
  validatorsCount: 6,
  coresCount: 2,
  slotDuration: 6,
  epochLength: 12,
  contestLength: 10,
  ticketsPerValidator: 3,
});

/**
 * Set of values for "full" chain as defined in JAM test vectors.
 * Please note that only validatorsCount and epochLength are "full", the rest is copied from "tiny".
 */
export const fullChainSpec = new ChainSpec({
  validatorsCount: 1023,
  epochLength: 600,
  coresCount: 2,
  slotDuration: 6,
  contestLength: 10,
  ticketsPerValidator: 3,
});
