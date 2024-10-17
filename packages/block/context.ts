import { WithDebug } from "./common";

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
export class ChainSpec extends WithDebug {
  /** Number of validators. */
  readonly validatorsCount: number;
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

  constructor(data: {
    validatorsCount: number;
    coresCount: number;
    slotDuration: number;
    epochLength: number;
    contestLength: number;
    ticketsPerValidator: number;
  }) {
    super();
    this.validatorsCount = data.validatorsCount;
    this.validatorsSuperMajority = Math.floor(data.validatorsCount / 3) * 2 + 1;
    this.coresCount = data.coresCount;
    this.slotDuration = data.slotDuration;
    this.epochLength = data.epochLength;
    this.contestLength = data.contestLength;
    this.ticketsPerValidator = data.ticketsPerValidator;
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

export function withContext<T>(name: string, cb: (ctx: ChainSpec) => T) {
  return (context: unknown) => {
    if (context instanceof ChainSpec) {
      return cb(context);
    }
    if (context) {
      throw new Error(`[${name}] Unexpected context type ${typeof context} while encoding/decoding.`);
    }
    throw new Error(`[${name}] Missing context while encoding/decoding!`);
  };
}
