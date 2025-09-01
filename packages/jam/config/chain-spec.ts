import { type U8, type U16, type U32, type U64, tryAsU8, tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
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

/** `W_G`: W_P * W_E = 4104 The size of a segment in octets. */
export const EC_SEGMENT_SIZE = 4104;

/**
 * Additional data that has to be passed to the codec to correctly parse incoming bytes.
 */
export class ChainSpec extends WithDebug {
  /** Number of validators. */
  readonly validatorsCount: U16;
  /** 1/3 of number of validators */
  readonly thirdOfValidators: U16;
  /** 2/3 of number of validators + 1 */
  readonly validatorsSuperMajority: U16;
  /** Number of cores. */
  readonly coresCount: U16;
  /**
   * `D`: Period in timeslots after which an unreferenced preimage may be expunged.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/445800445800?v=0.6.6
   */
  readonly preimageExpungePeriod: U32;
  /** Duration of a timeslot in seconds. */
  readonly slotDuration: U16;
  /** Length of the epoch in time slots. */
  readonly epochLength: U32;
  /** Length of the ticket contest in time slots. */
  readonly contestLength: U32;
  /** The maximum number of tickets each validator can submit. */
  readonly ticketsPerValidator: U8;
  /** The maximum number of tickets that can be included in a single block. */
  readonly maxTicketsPerExtrinsic: U8;
  /**
   * `R`: The rotation period of validator-core assignments, in timeslots.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/417f00417f00
   */
  readonly rotationPeriod: U16;
  /** `W_P`: The number of erasure-coded pieces in a segment. */
  readonly numberECPiecesPerSegment: U32;
  /** `W_E`: The basic size of erasure-coded pieces in octets. Computed from `W_E = W_G / W_P`. */
  readonly erasureCodedPieceSize: U32;
  /** `G_T`: The total gas allocated across all Accumulation. */
  readonly maxBlockGas: U64;
  /** `G_R`: The gas allocated to invoke a work-package’s Refine logic. */
  readonly maxRefineGas: U64;

  constructor(data: Omit<ChainSpec, "validatorsSuperMajority" | "thirdOfValidators" | "erasureCodedPieceSize">) {
    super();

    this.validatorsCount = data.validatorsCount;
    this.thirdOfValidators = tryAsU16(Math.floor(data.validatorsCount / 3));
    this.validatorsSuperMajority = tryAsU16(Math.floor(data.validatorsCount / 3) * 2 + 1);
    this.coresCount = data.coresCount;
    this.slotDuration = data.slotDuration;
    this.epochLength = data.epochLength;
    this.rotationPeriod = data.rotationPeriod;
    this.contestLength = data.contestLength;
    this.ticketsPerValidator = data.ticketsPerValidator;
    this.maxTicketsPerExtrinsic = data.maxTicketsPerExtrinsic;
    this.numberECPiecesPerSegment = data.numberECPiecesPerSegment;
    this.preimageExpungePeriod = data.preimageExpungePeriod;
    this.erasureCodedPieceSize = tryAsU32(EC_SEGMENT_SIZE / data.numberECPiecesPerSegment);
    this.maxBlockGas = data.maxBlockGas;
    this.maxRefineGas = data.maxRefineGas;
  }
}

/** Set of values for "tiny" chain as defined in JAM test vectors. */
export const tinyChainSpec = new ChainSpec({
  validatorsCount: tryAsU16(6),
  coresCount: tryAsU16(2),
  epochLength: tryAsU32(12),
  contestLength: tryAsU32(10),
  maxTicketsPerExtrinsic: tryAsU8(3),
  rotationPeriod: tryAsU16(4),
  slotDuration: tryAsU16(6),
  ticketsPerValidator: tryAsU8(3),
  numberECPiecesPerSegment: tryAsU32(1026),
  // https://github.com/davxy/jam-test-vectors/tree/v0.6.6/traces#preimage-expunge-delay
  preimageExpungePeriod: tryAsU32(32),
  maxBlockGas: tryAsU64(20_000_000),
  maxRefineGas: tryAsU64(1_000_000_000),
});

/**
 * Set of values for "full" chain as defined in JAM test vectors.
 * Please note that only validatorsCount and epochLength are "full", the rest is copied from "tiny".
 */
export const fullChainSpec = new ChainSpec({
  validatorsCount: tryAsU16(1023),
  coresCount: tryAsU16(341),
  epochLength: tryAsU32(600),
  contestLength: tryAsU32(500),
  maxTicketsPerExtrinsic: tryAsU8(16),
  rotationPeriod: tryAsU16(10),
  slotDuration: tryAsU16(6),
  ticketsPerValidator: tryAsU8(2),
  numberECPiecesPerSegment: tryAsU32(6),
  preimageExpungePeriod: tryAsU32(19_200),
  maxBlockGas: tryAsU64(3_500_000_000),
  maxRefineGas: tryAsU64(5_000_000_000),
});
