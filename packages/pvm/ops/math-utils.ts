import { MAX_VALUE } from "./math-consts";

export function add(a: number, b: number) {
  if (a > MAX_VALUE - b) {
    const spaceToMaxA = MAX_VALUE - a;
    const spaceToMaxB = MAX_VALUE - b;
    const overflowSum = spaceToMaxA + spaceToMaxB;
    return MAX_VALUE - overflowSum - 1;
  }

  return a + b;
}

export function sub(a: number, b: number) {
  if (a > b) {
    return MAX_VALUE - a + b + 1;
  }

  return b - a;
}

export function mulUnsigned(a: number, b: number) {
  if (a > MAX_VALUE / b) {
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

export function mulUpperSigned(a: number, b: number) {
  const sign = Math.sign(a) * Math.sign(b);
  const aAbs = a < 0 ? ~a + 1 : a;
  const bAbs = b < 0 ? ~b + 1 : b;

  if (sign < 0) {
    return ~mulUpperUnsigned(aAbs, bAbs) + 1;
  }
  return mulUpperUnsigned(aAbs, bAbs);
}
