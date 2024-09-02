export const NO_OF_REGISTERS = 13;
const REGISTER_SIZE_SHIFT = 2;

export class Registers {
  private buffer = new ArrayBuffer(NO_OF_REGISTERS << REGISTER_SIZE_SHIFT);
  asSigned = new Int32Array(this.buffer);
  asUnsigned = new Uint32Array(this.buffer);
  private bytes = new Uint8Array(this.buffer);

  getBytesAsLittleEndian(index: number) {
    const offset = index << REGISTER_SIZE_SHIFT;
    return this.bytes.subarray(offset, offset + 4);
  }
}
