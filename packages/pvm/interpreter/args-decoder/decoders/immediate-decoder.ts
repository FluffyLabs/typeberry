import { signExtend32To64 } from "../../registers";

const IMMEDIATE_SIZE = 4;

function interpretAsSigned(value: bigint) {
  const unsignedLimit = 1n << 64n;
  const signedLimit = 1n << 63n;

  if (value >= signedLimit) {
    return value - unsignedLimit;
  }

  return value;
}
export class ImmediateDecoder {
  private unsignedImmediate: Uint32Array;
  private signedImmediate: Int32Array;
  private view: DataView;
  private bytes: Uint8Array;

  constructor() {
    const buffer = new ArrayBuffer(IMMEDIATE_SIZE);
    this.unsignedImmediate = new Uint32Array(buffer);
    this.signedImmediate = new Int32Array(buffer);
    this.view = new DataView(buffer);
    this.bytes = new Uint8Array(buffer);
  }

  setBytes(bytes: Uint8Array) {
    const n = bytes.length;
    const msb = n > 0 ? bytes[n - 1] & 0x80 : 0;
    const noOfBytes = Math.min(n, IMMEDIATE_SIZE);
    const prefix = msb !== 0 ? 0xff : 0x00;

    for (let i = 0; i < noOfBytes; i++) {
      this.view.setUint8(i, bytes[i]);
    }

    for (let i = n; i < IMMEDIATE_SIZE; i++) {
      this.view.setUint8(i, prefix);
    }
  }

  /**
   * @deprecated Use getU32 instead
   */
  getUnsigned() {
    return this.unsignedImmediate[0];
  }

  /**
   * @deprecated Use getI32 instead
   */
  getSigned() {
    return this.signedImmediate[0];
  }

  getU32(): number {
    return this.unsignedImmediate[0];
  }

  getI32(): number {
    return this.signedImmediate[0];
  }

  getU64(): bigint {
    return signExtend32To64(this.unsignedImmediate[0]) & 0xffff_ffff_ffff_ffffn;
  }

  getI64(): bigint {
    return interpretAsSigned(signExtend32To64(this.signedImmediate[0]));
  }

  getBytesAsLittleEndian() {
    return this.bytes.subarray(0, IMMEDIATE_SIZE);
  }
}
