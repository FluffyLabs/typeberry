import { WithDebug } from "@typeberry/utils";

/**
 * Estimated number of validators.
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/418800418800
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
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/414200414200
 */
export const EST_CORES = 341;
/**
 * Estimated epoch length (in time slots).
 *
 * NOTE: Should ONLY be used to pre-allocate some data.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/414800414800
 */
export const EST_EPOCH_LENGTH = 600;

/**
 * Additional data that has to be passed to the codec to correctly parse incoming bytes.
 */
export class ChainSpec extends WithDebug {
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
  /**
   * `R`: The rotation period of validator-core assignments, in timeslots.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/417f00417f00
   */
  readonly rotationPeriod: number;
  /** Length of the ticket contest in time slots. */
  readonly contestLength: number;
  /** The maximum number of tickets each validator can submit. */
  readonly ticketsPerValidator: number;
  /** The maximum number of tickets that can be included in a single block. */
  readonly maxTicketsPerExtrinsic: number;
  /** Number of erasure coding pieces per segment. */
  readonly numberECPiecesPerSegment: number;

  /**
   * `D`: Period in timeslots after which an unreferenced preimage may be expunged.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/445800445800?v=0.6.6
   */
  readonly preimageExpungePeriod: number;

  constructor(data: Omit<ChainSpec, "validatorsSuperMajority" | "thirdOfValidators">) {
    super();

    this.validatorsCount = data.validatorsCount;
    this.thirdOfValidators = Math.floor(data.validatorsCount / 3);
    this.validatorsSuperMajority = Math.floor(data.validatorsCount / 3) * 2 + 1;
    this.coresCount = data.coresCount;
    this.slotDuration = data.slotDuration;
    this.epochLength = data.epochLength;
    this.rotationPeriod = data.rotationPeriod;
    this.contestLength = data.contestLength;
    this.ticketsPerValidator = data.ticketsPerValidator;
    this.maxTicketsPerExtrinsic = data.maxTicketsPerExtrinsic;
    this.numberECPiecesPerSegment = data.numberECPiecesPerSegment;
    this.preimageExpungePeriod = data.preimageExpungePeriod;
  }
}

/** Set of values for "tiny" chain as defined in JAM test vectors. */
export const tinyChainSpec = new ChainSpec({
  contestLength: 10,
  coresCount: 2,
  epochLength: 12,
  maxTicketsPerExtrinsic: 3,
  rotationPeriod: 4,
  slotDuration: 6,
  ticketsPerValidator: 3,
  validatorsCount: 6,
  numberECPiecesPerSegment: 1026,
  preimageExpungePeriod: 32, // why this number: https://github.com/davxy/jam-test-vectors/tree/v0.6.6/traces#preimage-expunge-delay
});

/**
 * Set of values for "full" chain as defined in JAM test vectors.
 * Please note that only validatorsCount and epochLength are "full", the rest is copied from "tiny".
 */
export const fullChainSpec = new ChainSpec({
  contestLength: 500,
  coresCount: 341,
  epochLength: 600,
  maxTicketsPerExtrinsic: 16,
  rotationPeriod: 10,
  slotDuration: 6,
  ticketsPerValidator: 2,
  validatorsCount: 1023,
  numberECPiecesPerSegment: 6,
  preimageExpungePeriod: 19_200,
});
