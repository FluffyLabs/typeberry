import { safeAllocUint8Array } from "@typeberry/utils";

export function bigintToUint8ArrayLE(value: bigint, byteLength = 4): Uint8Array {
  const buffer = safeAllocUint8Array(byteLength);
  let val = value;
  for (let i = 0; i < byteLength; i++) {
    buffer[i] = Number(val & 0xffn); // Extract the lowest 8 bits
    val >>= 8n; // Shift the value 8 bits to the right
  }

  return buffer;
}
