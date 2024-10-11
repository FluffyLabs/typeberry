export const EST_VALIDATORS = 1024;
export const EST_VALIDATORS_SUPER_MAJORITY = 768;
export const EST_CORES = 12;
export const EST_EPOCH_LENGTH = 12;

export class CodecContext {
  validatorsCount = 6;
  /** 2/3 of number of validators + 1 */
  validatorsSuperMajority = 5;
  epochLength = 12;
  coresCount = 2;
}
