export type LengthRange = {
  /** Inclusive value of minimal length of the sequence. */
  minLength: number;
  /** Inclusive value of maximal length of the sequence. */
  maxLength: number;
};

/** Validate that given sequence length is within expected range. */
export function validateLength(range: LengthRange, length: number, context: string) {
  if (length < range.minLength) {
    throw new Error(`${context}: length is below minimal. ${length} < ${range.minLength}`);
  }
  if (length > range.maxLength) {
    throw new Error(`${context}: length is above maximal. ${length} > ${range.maxLength}`);
  }
}
