import { check } from "@typeberry/utils";

const IMMEDIATE_SIZE = 8;

export class ExtendedWitdthImmediateDecoder {
  private unsignedImmediate: BigUint64Array;
  private bytes: Uint8Array;

  constructor() {
    const buffer = new ArrayBuffer(IMMEDIATE_SIZE);
    this.unsignedImmediate = new BigUint64Array(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  setBytes(bytes: Uint8Array) {
    check(
      bytes.length === 8,
      `Extended width immadiate has to have length that is equal to 8 but got: ${bytes.length}`,
    );

    for (let i = 0; i < IMMEDIATE_SIZE; i++) {
      this.bytes[i] = bytes[i];
    }
  }

  getValue() {
    return this.unsignedImmediate[0];
  }

  getBytesAsLittleEndian() {
    return this.bytes.subarray(0, IMMEDIATE_SIZE);
  }
}
