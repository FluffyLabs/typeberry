export function countBits32(val: number): number {
  let count = 0;
  let value = val;
  while (value !== 0) {
    value &= value - 1; // Clear the lowest set bit
    count++;
  }
  return count;
}

export function countBits64(val: bigint): number {
  let count = 0;
  let value = val;
  while (value !== 0n) {
    value &= value - 1n; // Clear the lowest set bit
    count++;
  }
  return count;
}

export function clz64(bigintValue: bigint): number {
  const highNumber = Number(bigintValue >> 32n);
  const lowNumber = Number(bigintValue & 0xff_ff_ff_ffn);

  const highResult = Math.clz32(highNumber);

  if (highResult < 32) {
    return highResult;
  }

  return highResult + Math.clz32(lowNumber);
}

export function ctz32(val: number): number {
  if (val === 0) {
    return 32;
  }

  let value = val;
  let count = 0;
  while ((value & 1) === 0) {
    count++;
    value >>>= 1;
  }
  return count;
}

export function ctz64(val: bigint): number {
  if (val === 0n) {
    return 64;
  }

  let value = val;
  let count = 0;
  while ((value & 1n) === 0n) {
    count++;
    value >>= 1n;
  }
  return count;
}
