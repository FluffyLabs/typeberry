export const NO_OF_REGISTERS = 13;
const REGISTER_SIZE_SHIFT = 2;

export class Registers {
  private buffer = new ArrayBuffer(NO_OF_REGISTERS << REGISTER_SIZE_SHIFT);
  asSigned = new Int32Array(this.buffer);
  asUnsigned = new Uint32Array(this.buffer);
  private bytes = new Uint8Array(this.buffer);

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
}
