import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { Memory } from "../memory";
import type { Registers } from "../registers";

export class StoreOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
  ) {}

  storeU8(address: number, registerIndex: number) {
    this.storeByte(address, this.regs.getBytesAsLittleEndian(registerIndex));
  }

  storeU16(address: number, registerIndex: number) {
    this.store2Bytes(address, this.regs.getBytesAsLittleEndian(registerIndex));
  }

  storeU32(address: number, registerIndex: number) {
    this.store4Bytes(address, this.regs.getBytesAsLittleEndian(registerIndex));
  }

  storeImmediateU8(address: number, immediateDecoder: ImmediateDecoder) {
    this.storeByte(address, immediateDecoder.getBytesAsLittleEndian());
  }

  storeImmediateU16(address: number, immediateDecoder: ImmediateDecoder) {
    this.store2Bytes(address, immediateDecoder.getBytesAsLittleEndian());
  }

  storeImmediateU32(address: number, immediateDecoder: ImmediateDecoder) {
    this.store4Bytes(address, immediateDecoder.getBytesAsLittleEndian());
  }

  storeImmediateIndU8(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = this.regs.asUnsigned[registerIndex] + firstImmediateDecoder.getUnsigned();
    this.storeByte(address, secondImmediateDecoder.getBytesAsLittleEndian());
  }

  storeImmediateIndU16(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = this.regs.asUnsigned[registerIndex] + firstImmediateDecoder.getUnsigned();
    this.store2Bytes(address, secondImmediateDecoder.getBytesAsLittleEndian());
  }

  storeImmediateIndU32(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = this.regs.asUnsigned[registerIndex] + firstImmediateDecoder.getUnsigned();
    this.store4Bytes(address, secondImmediateDecoder.getBytesAsLittleEndian());
  }

  private storeByte(address: number, bytes: Uint8Array) {
    this.memory.store(address, bytes.subarray(0, 1));
  }

  private store2Bytes(address: number, bytes: Uint8Array) {
    this.memory.store(address, bytes.subarray(0, 2));
  }

  private store4Bytes(address: number, bytes: Uint8Array) {
    this.memory.store(address, bytes.subarray(0, 4));
  }
}
