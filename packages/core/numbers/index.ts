import { check } from "@typeberry/utils";

export declare const __REPRESENTATION_BYTES__: unique symbol;

export type WithBytesRepresentation<Bytes extends number> = {
  readonly [__REPRESENTATION_BYTES__]: Bytes;
};

const asTypedNumber = <T, N extends number>(v: T): T & WithBytesRepresentation<N> =>
  v as T & WithBytesRepresentation<N>;

export type FixedSizeNumber<Bytes extends number> = number & WithBytesRepresentation<Bytes>;

/** Unsigned integer that can be represented as one byte. */
export type U8 = FixedSizeNumber<1>;
export const MAX_VALUE_U8 = 0xff;
/** Unsigned integer that can be represented as two bytes. */
export type U16 = FixedSizeNumber<2>;
export const MAX_VALUE_U16 = 0xffff;
/** Unsigned integer that can be represented as 4 bytes. */
export type U32 = FixedSizeNumber<4>;
export const MAX_VALUE_U32 = 0xffff_ffff;
/** Unsigned integer that can be represented as 8 bytes. */
export type U64 = bigint & WithBytesRepresentation<8>;
export const MAX_VALUE_U64 = 0xffff_ffff_ffff_ffffn;

/** Attempt to cast an input number into U8. */
export const tryAsU8 = (v: number): U8 => {
  check`${isU8(v)} input must have one-byte representation, got ${v}`;
  return asTypedNumber(v);
};
/** Check if given number is a valid U8 number. */
export const isU8 = (v: number): v is U8 => (v & MAX_VALUE_U8) === v;

/** Attempt to cast an input number into U16. */
export const tryAsU16 = (v: number): U16 => {
  check`${isU16(v)} input must have two-byte representation, got ${v}`;
  return asTypedNumber(v);
};

/** Check if given number is a valid U16 number. */
export const isU16 = (v: number): v is U16 => (v & MAX_VALUE_U16) === v;

/** Attempt to cast an input number into U32. */
export const tryAsU32 = (v: number): U32 => {
  check`${isU32(v)} input must have four-byte representation, got ${v}`;
  return asTypedNumber(v);
};

/** Check if given number is a valid U32 number. */
export const isU32 = (v: number): v is U32 => (v & MAX_VALUE_U32) >>> 0 === v;

/** Attempt to cast an input number into U64. */
export const tryAsU64 = (x: number | bigint): U64 => {
  const v = BigInt(x);
  check`${isU64(v)} input must have eight-byte representation, got ${x}`;
  return asTypedNumber(v);
};

/** Check if given number is a valid U64 number. */
export const isU64 = (v: bigint): v is U64 => (v & MAX_VALUE_U64) === v;

/** Collate two U32 parts into one U64. */
export const u64FromParts = ({ lower, upper }: { lower: U32; upper: U32 }): U64 => {
  const val = (BigInt(upper) << 32n) + BigInt(lower);
  return asTypedNumber(val);
};

/** Split U64 into lower & upper parts. */
export const u64IntoParts = (v: U64): { lower: U32; upper: U32 } => {
  // Number(...) safe: both parts are <= 0xffffffff
  const lower = Number(v & (2n ** 32n - 1n));
  const upper = Number(v >> 32n);

  return {
    lower: asTypedNumber(lower),
    upper: asTypedNumber(upper),
  };
};

/** A result of modulo arithmetic. */
export type Result<T> = {
  /** Was there an overflow/underflow? */
  overflow: boolean;
  /** What's the value after the operation. */
  value: T;
};

/**
 * Sum all provided U64 values using modulo arithmetic.
 * NOTE that the overflow may happen multiple times here!
 */
export function sumU64(...values: U64[]) {
  let sum = 0n;

  for (const v of values) {
    sum = sum + v;
  }

  const overflow = !isU64(sum);
  sum = sum & 0xffff_ffff_ffff_ffffn;

  return { overflow, value: tryAsU64(sum) };
}

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

  return { overflow, value: tryAsU32(sum) };
}

/**
 * Transform provided U32 number to little-endian representation.
 */
export function u32AsLeBytes(value: U32): Uint8Array {
  return new Uint8Array([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff]);
}

/**
 * Interpret 4-byte `Uint8Array` as U32 written as little endian.
 */
export function leBytesAsU32(uint8Array: Uint8Array): U32 {
  check`${uint8Array.length === 4} Input must be a Uint8Array of length 4`;
  return asTypedNumber(uint8Array[0] | (uint8Array[1] << 8) | (uint8Array[2] << 16) | (uint8Array[3] << 24));
}

/** Get the smallest value between U64 a and values given as input parameters. */
export const minU64 = (a: U64, ...values: U64[]): U64 => values.reduce((min, value) => (value > min ? min : value), a);

/** Get the biggest value between U64 a and values given as input parameters. */
export const maxU64 = (a: U64, ...values: U64[]): U64 => values.reduce((max, value) => (value < max ? max : value), a);
