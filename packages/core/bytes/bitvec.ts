import { check } from "@typeberry/utils";
import type { Bytes } from "./bytes.js";

/**
 * A sequence of bits with a packed in-memory representation.
 */
export class BitVec {
  /**
   * Wrap an existing bytes and treat them as [`BitVec`]
   */
  static fromBlob(data: Uint8Array, bitLength: number) {
    return new BitVec(data, bitLength);
  }

  static fromBytes<N extends number>(data: Bytes<N>, bitLength: number) {
    return new BitVec(data.raw, bitLength);
  }

  /**
   * Create new [`BitVec`] with all values set to `false`.
   */
  static empty(bitLength: number) {
    const data = new Uint8Array(Math.ceil(bitLength / 8));
    return new BitVec(data, bitLength);
  }

  public readonly byteLength;

  private constructor(
    private readonly data: Uint8Array,
    public readonly bitLength: number,
  ) {
    check`
      ${data.length * 8 >= bitLength}
      Not enough bytes in the data array. Need ${data.length * 8} has ${bitLength}.
    `;

    this.byteLength = Math.ceil(bitLength / 8);
  }

  /** Return a raw in-memory representation of this [`BitVec`]. */
  get raw(): Uint8Array {
    return this.data.subarray(0, this.byteLength);
  }

  /** Perform OR operation on all bits in place. */
  sumWith(other: BitVec) {
    check`
      ${other.bitLength === this.bitLength}
      Invalid bit length for sumWith: ${other.bitLength} vs ${this.bitLength}
    `;

    const otherRaw = other.raw;
    for (let i = 0; i < this.byteLength; i++) {
      this.data[i] |= otherRaw[i];
    }
  }

  /**
   * Set the bit at index `idx` to value `val`.
   */
  setBit(idx: number, val: boolean) {
    check`${idx >= 0 && idx < this.bitLength} Index out of bounds. Need ${idx} has ${this.bitLength}.`;

    const byteIndex = Math.floor(idx / 8);
    const bitIndexInByte = idx % 8;
    const mask = 1 << bitIndexInByte;
    if (val) {
      this.data[byteIndex] |= mask;
    } else {
      this.data[byteIndex] &= ~mask;
    }
  }

  /**
   * Return `true` if the bit at index `idx` is set.
   */
  isSet(idx: number): boolean {
    check`${idx >= 0 && idx < this.bitLength} Index out of bounds. Need ${idx} has ${this.bitLength}.`;
    const byteIndex = Math.floor(idx / 8);
    const bitIndexInByte = idx % 8;
    const mask = 1 << bitIndexInByte;
    return (this.data[byteIndex] & mask) > 0;
  }

  /**
   * Iterate over indices of bits that are set.
   */
  *indicesOfSetBits() {
    for (let b = 0; b < this.bitLength; b++) {
      const byteIndex = b >> 3;
      const bitIndex = b - (byteIndex << 3);

      const byte = this.data[byteIndex];
      const bitValue = byte >> bitIndex;
      if ((bitValue & 0b1) === 0b1) {
        yield b;
      }
    }
  }
}
