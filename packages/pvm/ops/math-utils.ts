import { MAX_VALUE } from "./math-consts";

/**
 * Overflowing addition for two-complement representation of 32-bit signed numbers.
 */
export function add(a: number, b: number) {
  if (a > MAX_VALUE - b) {
    /**
     * MAX_VALUE is equal to 2 ** 32 - 1
     * MAX_VALUE - ( (MAX_VALUE - a) + (MAX_VALUE - b) ) - 1
     * = MAX_VALUE - (2MAX_VALUE - a - b) -1
     * = MAX_VALUE - 2MAX_VALUE + a + b - 1
     * = a + b - MAX_VALUE - 1
     * = a + b - 2 ** 32
     * but we know that 2MAX_VALUE > a + b > MAX_VALUE so in this case:
     * a + b - 2 ** 32 <=> (a + b) % 2 ** 32
     * = (a + b) % (MAX_VALUE + 1)
     */
    const spaceToMaxA = MAX_VALUE - a;
    const spaceToMaxB = MAX_VALUE - b;
    const overflowSum = spaceToMaxA + spaceToMaxB;
    return MAX_VALUE - overflowSum - 1;
  }

  return a + b;
}

/**
 * Overflowing subtraction for two-complement representation of 32-bit signed numbers.
 */
export function sub(a: number, b: number) {
  if (a > b) {
    return MAX_VALUE - a + b + 1;
  }

  return b - a;
}

const MUL_THRESHOLD = 2 ** 16;

/**
 * Efficiently multiply the two given numbers modulo 2**32 (i.e. lower 32-bit part of the multiplication).
 * 
 * In case the numbers fit into 2**32 we simply calculate their multiplication.
 * In case the numbers are larger we split them into higher and lower bits
 * and perform the multiplication separately to make sure we don't overflow
 * the 2**32 and `MAX_SAFE_INTEGER`.
 */
export function mulLowerUnsigned(a: number, b: number) {
  if (a > MUL_THRESHOLD || b > MUL_THRESHOLD) {
    const aHigh = a >> 16;
    const aLow = a & 0xffff;
    const bHigh = b >> 16;
    const bLow = b & 0xffff;

    const lowLow = aLow * bLow;
    const lowHigh = aLow * bHigh;
    const highLow = aHigh * bLow;

    const carry = (lowLow >> 16) + (lowHigh & 0xffff) + (highLow & 0xffff);
    return (lowLow & 0xffff) | (carry << 16);
  }

  return a * b;
}

/**
 * Multiply two unsigned 32-bit numbers and take the upper 32-bits of the result.
 *  
 * The result of multiplication is a 64-bits number and we are only interested in the part that lands in the upper 32-bits.
 * For example if we multiply `0xffffffff * 0xffffffff`, we get:
 
 * |   32-bits  |   32-bits  |
 * +------------+------------+
 * |    upper   |    lower   |
 * | 0xfffffffe | 0x00000001 |
 *
 * So `0xfffffffe` is returned.
 */
export function mulUpperUnsigned(a: number, b: number) {
  const aHigh = a >> 16;
  const aLow = a & 0xffff;
  const bHigh = b >> 16;
  const bLow = b & 0xffff;

  const lowLow = aLow * bLow;
  const lowHigh = aLow * bHigh;
  const highLow = aHigh * bLow;
  const highHigh = aHigh * bHigh;
  const carry = (lowLow >> 16) + (lowHigh & 0xffff) + (highLow & 0xffff);

  return highHigh + (lowLow >> 16) + (highLow >> 16) + (carry >> 16);
}

/**
 * Same as [mulUpperUnsigned] but treat the arguments as signed (two-complement) 32-bit numbers and the result alike.
 */
export function mulUpperSigned(a: number, b: number) {
  const sign = Math.sign(a) * Math.sign(b);
  const aAbs = a < 0 ? ~a + 1 : a;
  const bAbs = b < 0 ? ~b + 1 : b;

  if (sign < 0) {
    return ~mulUpperUnsigned(aAbs, bAbs) + 1;
  }
  return mulUpperUnsigned(aAbs, bAbs);
}
