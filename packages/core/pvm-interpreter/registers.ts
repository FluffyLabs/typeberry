import { type Opaque, check, ensure } from "@typeberry/utils";

export const NO_OF_REGISTERS = 13;
const REGISTER_SIZE_SHIFT = 3;

export type RegisterIndex = Opaque<number, "register index">;

export const tryAsRegisterIndex = (index: number): RegisterIndex =>
  ensure(index, index >= 0 && index <= NO_OF_REGISTERS, `Incorrect register index: ${index}!`);

export class Registers {
  private asSigned: BigInt64Array;
  private asUnsigned: BigUint64Array;

  private constructor(private readonly bytes = new Uint8Array(NO_OF_REGISTERS << REGISTER_SIZE_SHIFT)) {
    this.asSigned = new BigInt64Array(bytes.buffer, bytes.byteOffset);
    this.asUnsigned = new BigUint64Array(bytes.buffer, bytes.byteOffset);
  }

  static fromBytes(bytes: Uint8Array) {
    check(bytes.length === NO_OF_REGISTERS << REGISTER_SIZE_SHIFT, "Invalid size of registers bytes.");
    return new Registers(bytes);
  }

  static fromBigUint64Array(array: BigUint64Array) {
    check(array.length === NO_OF_REGISTERS, "Invalid size of registers array.");
    return new Registers(new Uint8Array(array.buffer));
  }

  static new() {
    return new Registers();
  }

  getBytesAsLittleEndian(index: number, len: number) {
    const offset = index << REGISTER_SIZE_SHIFT;
    return this.bytes.subarray(offset, offset + len);
  }

  getAllBytesAsLittleEndian() {
    return this.bytes;
  }

  copyFrom(regs: Registers) {
    this.bytes.set(regs.bytes);
    this.asSigned.set(regs.asSigned);
    this.asUnsigned.set(regs.asUnsigned);
  }

  reset() {
    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.asUnsigned[i] = 0n;
    }
  }

  getU32(registerIndex: number) {
    return Number(this.asUnsigned[registerIndex] & 0xff_ff_ff_ffn);
  }

  getI32(registerIndex: number) {
    return Number(this.getU32(registerIndex)) >> 0;
  }

  setU32(registerIndex: number, value: number) {
    this.asUnsigned[registerIndex] = signExtend32To64(value);
  }

  setI32(registerIndex: number, value: number) {
    this.asSigned[registerIndex] = signExtend32To64(value);
  }

  getU64(registerIndex: number) {
    return this.asUnsigned[registerIndex];
  }

  getI64(registerIndex: number) {
    return this.asSigned[registerIndex];
  }

  setU64(registerIndex: number, value: bigint) {
    this.asUnsigned[registerIndex] = value;
  }

  setI64(registerIndex: number, value: bigint) {
    this.asSigned[registerIndex] = value;
  }

  getAllU64() {
    return this.asUnsigned;
  }
}

export function signExtend32To64(value: number | bigint): bigint {
  // Convert to BigInt if the value is a number
  const bigValue = typeof value === "number" ? BigInt(value) : value;

  // Ensure the value is treated as a 32-bit integer
  const mask32 = BigInt(0xffffffff);
  const signBit = BigInt(0x80000000);
  const maskedValue = bigValue & mask32;

  // Check the sign bit and extend the sign if necessary
  if ((maskedValue & signBit) !== BigInt(0)) {
    // If the sign bit is set, extend with ones
    return maskedValue | ~mask32;
  }
  // If the sign bit is not set, return as is
  return maskedValue;
}
