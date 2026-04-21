import { check } from "@typeberry/utils";

export class JumpTable {
  private indices: Uint32Array;

  /** Create an empty jump table. */
  static empty() {
    return new JumpTable(0, new Uint8Array());
  }

  /** Decode a jump table from a raw bytes buffer. */
  static fromRaw(itemByteLength: number, bytes: Uint8Array) {
    check`
      ${itemByteLength === 0 || bytes.length % itemByteLength === 0}
      Length of jump table (${bytes.length}) should be a multiple of item lenght (${itemByteLength})!
    `;
    return new JumpTable(itemByteLength, bytes);
  }

  private constructor(itemByteLength: number, bytes: Uint8Array) {
    const length = itemByteLength === 0 ? 0 : bytes.length / itemByteLength;

    this.indices = new Uint32Array(length);

    for (let i = 0; i < length; i++) {
      this.indices[i] = this.decodeNext(bytes.subarray(i * itemByteLength, (i + 1) * itemByteLength));
    }
  }

  private decodeNext(bytes: Uint8Array): number {
    const itemByteLength = bytes.length;
    let value = 0;

    for (let i = 0; i < itemByteLength; i++) {
      if ((value & 0xff00_0000) > 0) {
        // the value is going to exceed u32 so we can clamp it
        return 2 ** 32 - 1;
      }
      value <<= 8;
      value |= bytes[itemByteLength - i - 1];
    }

    return value;
  }

  hasIndex(index: number) {
    return index < this.indices.length && index >= 0;
  }

  getDestination(index: number) {
    return this.indices[index];
  }

  getSize() {
    return this.indices.length;
  }

  copyFrom(jt: JumpTable) {
    this.indices = jt.indices;
  }
}
