export function countBits32(val: number) {
  let x = val;
  x = x - ((x >> 1) & 0x55555555); // Subtract pairs of bits
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333); // Sum groups of 4 bits
  x = (x + (x >> 4)) & 0x0f0f0f0f; // Sum groups of 8 bits
  x = x + (x >> 8); // Sum groups of 16 bits
  x = x + (x >> 16); // Sum groups of 32 bits
  return x & 0x3f; // Mask out excess bits
}

export function countBits64(val: bigint) {
  let x = val;
  x = x - ((x >> 1n) & 0x5555555555555555n); // Subtract pairs of bits
  x = (x & 0x3333333333333333n) + ((x >> 2n) & 0x3333333333333333n); // Sum groups of 4 bits
  x = (x + (x >> 4n)) & 0x0f0f0f0f0f0f0f0fn; // Sum groups of 8 bits
  x = x + (x >> 8n); // Sum groups of 16 bits
  x = x + (x >> 16n); // Sum groups of 32 bits
  x = x + (x >> 32n); // Sum groups of 64 bits
  return Number(x & 0x7fn); // Mask and return result as a regular number (0–64)
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
