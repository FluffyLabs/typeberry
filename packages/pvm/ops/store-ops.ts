import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import { createMemoryIndex } from "../memory/memory-index";
import type { Registers } from "../registers";
import { Result } from "../result";

export class StoreOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
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

  storeIndU8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.storeByte(address, this.regs.getBytesAsLittleEndian(secondRegisterIndex));
  }

  storeIndU16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.store2Bytes(address, this.regs.getBytesAsLittleEndian(secondRegisterIndex));
  }

  storeIndU32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = this.regs.asUnsigned[firstRegisterIndex] + immediateDecoder.getUnsigned();
    this.store4Bytes(address, this.regs.getBytesAsLittleEndian(secondRegisterIndex));
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
    this.store(address, bytes.subarray(0, 1));
  }

  private store2Bytes(address: number, bytes: Uint8Array) {
    this.store(address, bytes.subarray(0, 2));
  }

  private store4Bytes(address: number, bytes: Uint8Array) {
    this.store(address, bytes.subarray(0, 4));
  }

  private store(address: number, bytes: Uint8Array) {
    const storeResult = this.memory.storeFrom(createMemoryIndex(address), bytes);

    if (storeResult !== null) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = address;
    }
  }
}
