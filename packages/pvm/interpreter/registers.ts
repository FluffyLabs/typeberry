import { type Opaque, check, ensure } from "@typeberry/utils";

export const NO_OF_REGISTERS = 13;
const REGISTER_SIZE_SHIFT = 2;

export type RegisterIndex = Opaque<number, "register index">;

export const tryAsRegisterIndex = (index: number): RegisterIndex =>
  ensure(index, index >= 0 && index <= NO_OF_REGISTERS, `Incorrect register index: ${index}!`);

export class Registers {
  private asSigned: Int32Array;
  private asUnsigned: Uint32Array;

  constructor(private readonly bytes = new Uint8Array(NO_OF_REGISTERS << REGISTER_SIZE_SHIFT)) {
    check(bytes.length === NO_OF_REGISTERS << REGISTER_SIZE_SHIFT, "Invalid size of registers array.");
    this.asSigned = new Int32Array(bytes.buffer, bytes.byteOffset);
    this.asUnsigned = new Uint32Array(bytes.buffer, bytes.byteOffset);
  }

  getBytesAsLittleEndian(index: number, len: number) {
    const offset = index << REGISTER_SIZE_SHIFT;
    return this.bytes.subarray(offset, offset + len);
  }

  copyFrom(regs: Registers | Uint32Array) {
    const array = regs instanceof Uint32Array ? regs : regs.asUnsigned;
    this.asUnsigned.set(array);
  }

  reset() {
    for (let i = 0; i < NO_OF_REGISTERS; i++) {
      this.asUnsigned[i] = 0;
    }
  }

  get(registerIndex: number, asSigned = false) {
    if (asSigned) {
      return this.asSigned[registerIndex];
    }

    return this.asUnsigned[registerIndex];
  }

  set(registerIndex: number, value: number, asSigned = false) {
    if (asSigned) {
      this.asSigned[registerIndex] = value;
    } else {
      this.asUnsigned[registerIndex] = value;
    }
  }
}
