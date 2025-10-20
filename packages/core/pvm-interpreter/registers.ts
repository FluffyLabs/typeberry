import { tryAsU64, type U64 } from "@typeberry/numbers";
import type { IRegisters } from "@typeberry/pvm-interface";
import { asOpaqueType, check, type Opaque, safeAllocUint8Array } from "@typeberry/utils";

export const NO_OF_REGISTERS = 13;
const REGISTER_SIZE_SHIFT = 3;

export type RegisterIndex = Opaque<number, "register index">;

export const tryAsRegisterIndex = (index: number): RegisterIndex => {
  check`${index >= 0 && index < NO_OF_REGISTERS} Incorrect register index: ${index}!`;
  return asOpaqueType(index);
};

export class Registers implements IRegisters {
  private asSigned: BigInt64Array;
  private asUnsigned: BigUint64Array;

  constructor(private readonly bytes = safeAllocUint8Array(NO_OF_REGISTERS << REGISTER_SIZE_SHIFT)) {
    check`${bytes.length === NO_OF_REGISTERS << REGISTER_SIZE_SHIFT} Invalid size of registers array.`;
    this.asSigned = new BigInt64Array(bytes.buffer, bytes.byteOffset);
    this.asUnsigned = new BigUint64Array(bytes.buffer, bytes.byteOffset);
  }

  set(registerIndex: number, value: U64): void {
    this.setU64(registerIndex, value);
  }

  get(registerIndex: number): U64 {
    return tryAsU64(this.getU64(registerIndex));
  }

  getEncoded() {
    return this.bytes;
  }

  static fromBytes(bytes: Uint8Array) {
    check`${bytes.length === NO_OF_REGISTERS << REGISTER_SIZE_SHIFT} Invalid size of registers array.`;
    return new Registers(bytes);
  }

  getBytesAsLittleEndian(index: number, len: number) {
    const offset = index << REGISTER_SIZE_SHIFT;
    return this.bytes.subarray(offset, offset + len);
  }

  copyFrom(regs: Registers | BigUint64Array) {
    const array = regs instanceof BigUint64Array ? regs : regs.asUnsigned;
    this.asUnsigned.set(array);
  }

  reset() {
    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.asUnsigned[i] = 0n;
    }
  }

  getLowerU32(registerIndex: number) {
    return Number(this.asUnsigned[registerIndex] & 0xff_ff_ff_ffn);
  }

  getLowerI32(registerIndex: number) {
    return Number(this.getLowerU32(registerIndex)) >> 0;
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
