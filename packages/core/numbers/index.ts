import { asOpaqueType, ensure, check } from "@typeberry/utils";

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
  ensure<number, U8>(v, isU8(v), `input must have one-byte representation, got ${v}`);
/** Check if given number is a valid U8 number. */
export const isU8 = (v: number): v is U8 => (v & 0xff) === v;

/** Attempt to cast an input number into U16. */
export const tryAsU16 = (v: number): U16 =>
  ensure<number, U16>(v, isU16(v), `input must have two-byte representation, got ${v}`);
/** Check if given number is a valid U16 number. */
export const isU16 = (v: number): v is U16 => (v & 0xff_ff) === v;

/** Attempt to cast an input number into U32. */
export const tryAsU32 = (v: number): U32 =>
  ensure<number, U32>(v, isU32(v), `input must have four-byte representation, got ${v}`);
/** Check if given number is a valid U32 number. */
export const isU32 = (v: number): v is U32 => (v & 0xff_ff_ff_ff) >>> 0 === v;

/** Attempt to cast an input number into U64. */
export const tryAsU64 = (x: number | bigint): U64 => {
  const v = BigInt(x);
  return ensure<bigint, U64>(v, isU64(v), `input must have eight-byte representation, got ${x}`);
};
/** Check if given number is a valid U64 number. */
export const isU64 = (v: bigint): v is U64 => (v & 0xffff_ffff_ffff_ffffn) === v;

/** Collate two U32 parts into one U64. */
export const u64FromParts = ({ lower, upper }: { lower: U32; upper: U32 }): U64 => {
  const val = (BigInt(upper) << 32n) + BigInt(lower);
  return asOpaqueType(val);
};

/** Split U64 into lower & upper parts. */
export const u64IntoParts = (v: U64): { lower: U32; upper: U32 } => {
  const lower = v & (2n ** 32n - 1n);
  const upper = v >> 32n;

  return {
    lower: asOpaqueType(Number(lower)),
    upper: asOpaqueType(Number(upper)),
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

  return { overflow, value: sum as U64 };
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

  return { overflow, value: sum as U32 };
}

/**
 * Transform provided number to little-endian representation.
 */
export function* u32AsLittleEndian(value: U32) {
  yield value & 0xff;
  yield (value >> 8) & 0xff;
  yield (value >> 16) & 0xff;
  yield (value >> 24) & 0xff;
}

/**
 * Write U32 as LE-bytes into the destination buffer.
 */
export function writeU32(destination: Uint8Array, value: U32) {
  check(destination.length >= 4, "Not enough space in the destination.");
  let i = 0;
  for (const byte of u32AsLittleEndian(value)) {
    destination[i] = byte;
    i += 1;
  }
}
