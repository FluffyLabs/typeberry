// TODO [ToDr] This should be `unique symbol`, but for some reason
// I can't figure out how to build `@typeberry/blocks` package.
declare const __REPRESENTATION_BYTES__: "REPRESENTATION_BYTES";

type WithBytesRepresentation<Bytes extends number> = {
  readonly [__REPRESENTATION_BYTES__]: Bytes;
};
export type FixedSizeNumber<Bytes extends number> = number & WithBytesRepresentation<Bytes>;

/** Unsigned integer that can be represented as one byte. */
export type U8 = FixedSizeNumber<1>;
/** Unsigned integer that can be represented as two bytes. */
export type U16 = FixedSizeNumber<2>;
/** Unsigned integer that can be represented as 4 bytes. */
export type U32 = FixedSizeNumber<4>;
/** Unsigned integer that can be represented as 8 bytes. */
export type U64 = bigint & WithBytesRepresentation<8>;

// TODO [ToDr] Safe casting / math operations?

/** A result of modulo arithmetic. */
export type Result<T> = {
  /** Was there an overflow/underflow? */
  overflow: boolean;
  /** What's the value after the operation. */
  value: T;
};

/**
 * Sum all provided U32 values using modulo arithmetic.
 * NOTE that the overflow may happen multiple times here!
 */
export function sumU32(...values: U32[]) {
  let sum = 0;
  let overflow = false;

  for (const v of values) {
    const prev = sum;
    sum = (sum + v) >>> 0;
    overflow ||= prev > sum;
  }

  return { overflow, value: sum };
}
