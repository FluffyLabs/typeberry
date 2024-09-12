import {check} from "@typeberry/utils";
import {Bytes} from "./bytes";

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
  static create(bitLength: number) {
    const data = new Uint8Array(Math.ceil(bitLength / 8));
    return new BitVec(data, bitLength);
  }

  public readonly byteLength;

  private constructor(
    private readonly data: Uint8Array,
    public readonly bitLength: number,
  ) {
    check(data.length * 8 >= bitLength, `Not enough bytes in the data array. Need ${data.length * 8} has ${bitLength}.`);

    this.byteLength = Math.ceil(bitLength / 8);
  }

  /** Return a raw in-memory representation of this [`BitVec`]. */
  raw(): Uint8Array {
    return this.data.subarray(0, this.byteLength);
  }

  /**
   * Set the bit at index `idx` to value `val`.
   */
  setBit(idx: number, val: boolean) {
    check(idx < this.bitLength, `Index out of bounds. Need ${idx} has ${this.bitLength}.`);

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
    check(idx < this.bitLength, `Index out of bounds. Need ${idx} has ${this.bitLength}.`);
    const byteIndex = Math.floor(idx / 8);
    const bitIndexInByte = idx % 8;
    const mask = 1 << bitIndexInByte;
    return (this.data[byteIndex] & mask) > 0;
  }
}
