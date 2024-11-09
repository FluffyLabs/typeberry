import { ensure } from "@typeberry/utils";

/**
 * TODO [ToDr] This should be `unique symbol`, but for some reason
 * I can't figure out how to build `@typeberry/blocks` package.
 */
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

/** Attempt to cast an input number into U8. */
export const tryAsU8 = (v: number): U8 =>
  ensure<number, U8>(v, (v & 0xff) === v, `input must have one-byte representation, got ${v}`);

/** Attempt to cast an input number into U16. */
export const tryAsU16 = (v: number): U16 =>
  ensure<number, U16>(v, (v & 0xff_ff) === v, `input must have two-byte representation, got ${v}`);

/** Attempt to cast an input number into U32. */
export const tryAsU32 = (v: number): U32 =>
  ensure<number, U32>(v, (v & 0xff_ff_ff_ff) >>> 0 === v, `input must have four-byte representation, got ${v}`);

/** Attempt to cast an input number into U64. */
export const tryAsU64 = (x: number | bigint): U64 => {
  const v = BigInt(x);
  return ensure<bigint, U64>(
    v,
    (v & 0xffff_ffff_ffff_ffffn) === v,
    `input must have eight-byte representation, got ${x}`,
  );
};

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
