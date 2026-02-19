/** Clamp register nibble to valid range 0-12. */
export function clampReg(nibble: number): number {
  return nibble > 12 ? 12 : nibble;
}

/** Clamp nibble to length 0-4 (for immediate length encoding). */
export function clampLen(nibble: number): number {
  return nibble > 4 ? 4 : nibble;
}

/**
 * Read signed 32-bit immediate from code bytes (little-endian, sign-extended).
 * Zero-copy: reads directly from code[] without subarray or DataView.
 */
export function readSignedImm(code: Uint8Array, offset: number, length: number): number {
  if (length === 0) {
    return 0;
  }
  let val = 0;
  const n = length < 4 ? length : 4;
  for (let i = 0; i < n; i++) {
    val |= code[offset + i] << (i << 3);
  }
  // Sign extend from n bytes to 32 bits
  const shift = (4 - n) << 3;
  return (val << shift) >> shift;
}

/**
 * Read unsigned 32-bit immediate from code bytes (little-endian, zero-extended).
 * Used for ECALLI host call index and other unsigned immediates.
 */
export function readUnsignedImm32(code: Uint8Array, offset: number, length: number): number {
  if (length === 0) {
    return 0;
  }
  let val = 0;
  const n = length < 4 ? length : 4;
  for (let i = 0; i < n; i++) {
    val |= code[offset + i] << (i << 3);
  }
  return val >>> 0; // ensure unsigned
}

/**
 * Read signed immediate as BigInt (sign-extended to 64 bits).
 * Used for branch_imm and other instructions that need BigInt comparison.
 */
export function readSignedImmBigInt(code: Uint8Array, offset: number, length: number): bigint {
  return BigInt(readSignedImm(code, offset, length));
}

/**
 * Read unsigned 64-bit immediate (BigInt). Used for LOAD_IMM_64.
 * Reads up to 8 bytes little-endian, sign-extends from the last byte.
 */
export function readImm64(code: Uint8Array, offset: number, length: number): bigint {
  if (length === 0) {
    return 0n;
  }
  const n = length < 8 ? length : 8;
  let val = 0n;
  for (let i = 0; i < n; i++) {
    val |= BigInt(code[offset + i]) << BigInt(i << 3);
  }
  // Sign-extend from n bytes to 64 bits
  const msb = code[offset + n - 1];
  if (msb & 0x80) {
    // Fill upper bytes with 0xFF
    for (let i = n; i < 8; i++) {
      val |= 0xffn << BigInt(i << 3);
    }
  }
  return BigInt.asUintN(64, val);
}

const MASK_32 = 0xffffffffn;

/**
 * 32-bit overflowing add, result truncated to 32 bits as Number.
 * Uses bitwise OR to stay in i32 range (sign-extends), matching the original Math.imul-style approach.
 */
export function addU32(a: number, b: number): number {
  return (a + b) | 0;
}

/**
 * 32-bit overflowing subtract.
 */
export function subU32(a: number, b: number): number {
  return (a - b) | 0;
}

/**
 * 32-bit overflowing multiply. Uses Math.imul for correct 32-bit semantics.
 */
export function mulU32(a: number, b: number): number {
  return Math.imul(a, b);
}

/** 64-bit unsigned add with BigInt, truncated to 64 bits. */
export function addU64(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, a + b);
}

/** 64-bit unsigned sub with BigInt, truncated to 64 bits. */
export function subU64(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, a - b);
}

/** 64-bit unsigned mul with BigInt, truncated to 64 bits. */
export function mulU64(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, a * b);
}

/** Upper 64 bits of 128-bit unsigned * unsigned multiplication. */
export function mulUpperUU(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, (BigInt.asUintN(64, a) * BigInt.asUintN(64, b)) >> 64n);
}

/** Upper 64 bits of 128-bit signed * signed multiplication. */
export function mulUpperSS(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, (BigInt.asIntN(64, a) * BigInt.asIntN(64, b)) >> 64n);
}

/** Upper 64 bits of 128-bit signed * unsigned multiplication. */
export function mulUpperSU(a: bigint, b: bigint): bigint {
  return BigInt.asUintN(64, (BigInt.asIntN(64, a) * BigInt.asUintN(64, b)) >> 64n);
}

/** Rotate 32-bit value right by given amount. */
export function rotateRight32(value: number, shift: number): number {
  const s = shift & 31;
  if (s === 0) {
    return value;
  }
  return (value >>> s) | (value << (32 - s)) | 0;
}

/** Rotate 64-bit value right by given amount. */
export function rotateRight64(value: bigint, shift: bigint): bigint {
  const s = BigInt.asUintN(6, shift); // shift % 64
  if (s === 0n) {
    return value;
  }
  const v = BigInt.asUintN(64, value);
  return BigInt.asUintN(64, (v >> s) | (v << (64n - s)));
}

/** Rotate 32-bit value left by given amount. */
export function rotateLeft32(value: number, shift: number): number {
  const s = shift & 31;
  if (s === 0) {
    return value;
  }
  return (value << s) | (value >>> (32 - s)) | 0;
}

/** Rotate 64-bit value left by given amount. */
export function rotateLeft64(value: bigint, shift: bigint): bigint {
  const s = BigInt.asUintN(6, shift); // shift % 64
  if (s === 0n) {
    return value;
  }
  const v = BigInt.asUintN(64, value);
  return BigInt.asUintN(64, (v << s) | (v >> (64n - s)));
}

/** Count set bits (popcount) for a 32-bit number. */
export function countBits32(val: number): number {
  let v = val >>> 0;
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Count set bits (popcount) for a 64-bit bigint. */
export function countBits64(val: bigint): number {
  const v = BigInt.asUintN(64, val);
  const lo = Number(v & MASK_32);
  const hi = Number((v >> 32n) & MASK_32);
  return countBits32(lo) + countBits32(hi);
}

/** Count leading zeros for a 64-bit bigint. */
export function clz64(val: bigint): number {
  const v = BigInt.asUintN(64, val);
  const hi = Number((v >> 32n) & MASK_32);
  if (hi !== 0) {
    return Math.clz32(hi);
  }
  const lo = Number(v & MASK_32);
  return 32 + Math.clz32(lo);
}

/** Count trailing zeros for a 32-bit number. */
export function ctz32(val: number): number {
  const v = val | 0;
  if (v === 0) {
    return 32;
  }
  return 31 - Math.clz32(v & -v);
}

/** Count trailing zeros for a 64-bit bigint. */
export function ctz64(val: bigint): number {
  const v = BigInt.asUintN(64, val);
  const lo = Number(v & MASK_32);
  if (lo !== 0) {
    return ctz32(lo);
  }
  const hi = Number((v >> 32n) & MASK_32);
  return 32 + ctz32(hi);
}
