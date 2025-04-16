import type { ImmediateDecoder } from "../args-decoder/decoders/immediate-decoder";
import type { InstructionResult } from "../instruction-result";
import type { Memory } from "../memory";
import { tryAsMemoryIndex } from "../memory/memory-index";
import { getStartPageIndex } from "../memory/memory-utils";
import type { Registers } from "../registers";
import { Result } from "../result";
import { addWithOverflowU32 } from "./math-utils";

export class StoreOps {
  constructor(
    private regs: Registers,
    private memory: Memory,
    private instructionResult: InstructionResult,
  ) {}

  storeU8(address: number, registerIndex: number) {
    this.store(address, this.regs.getBytesAsLittleEndian(registerIndex, 1));
  }

  storeU16(address: number, registerIndex: number) {
    this.store(address, this.regs.getBytesAsLittleEndian(registerIndex, 2));
  }

  storeU32(address: number, registerIndex: number) {
    this.store(address, this.regs.getBytesAsLittleEndian(registerIndex, 4));
  }

  storeU64(address: number, registerIndex: number) {
    this.store(address, this.regs.getBytesAsLittleEndian(registerIndex, 8));
  }

  storeIndU8(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getLowerU32(secondRegisterIndex), immediateDecoder.getUnsigned());
    this.store(address, this.regs.getBytesAsLittleEndian(firstRegisterIndex, 1));
  }

  storeIndU16(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getLowerU32(secondRegisterIndex), immediateDecoder.getUnsigned());
    this.store(address, this.regs.getBytesAsLittleEndian(firstRegisterIndex, 2));
  }

  storeIndU32(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getLowerU32(secondRegisterIndex), immediateDecoder.getUnsigned());
    this.store(address, this.regs.getBytesAsLittleEndian(firstRegisterIndex, 4));
  }

  storeIndU64(firstRegisterIndex: number, secondRegisterIndex: number, immediateDecoder: ImmediateDecoder) {
    const address = addWithOverflowU32(this.regs.getLowerU32(secondRegisterIndex), immediateDecoder.getUnsigned());
    this.store(address, this.regs.getBytesAsLittleEndian(firstRegisterIndex, 8));
  }

  storeImmediateU8(address: number, immediateDecoder: ImmediateDecoder) {
    this.store(address, immediateDecoder.getBytesAsLittleEndian().subarray(0, 1));
  }

  storeImmediateU16(address: number, immediateDecoder: ImmediateDecoder) {
    this.store(address, immediateDecoder.getBytesAsLittleEndian().subarray(0, 2));
  }

  storeImmediateU32(address: number, immediateDecoder: ImmediateDecoder) {
    this.store(address, immediateDecoder.getBytesAsLittleEndian().subarray(0, 4));
  }

  storeImmediateU64(address: number, immediateDecoder: ImmediateDecoder) {
    this.store(address, immediateDecoder.getExtendedBytesAsLittleEndian());
  }

  storeImmediateIndU8(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = addWithOverflowU32(this.regs.getLowerU32(registerIndex), firstImmediateDecoder.getUnsigned());
    this.store(address, secondImmediateDecoder.getBytesAsLittleEndian().subarray(0, 1));
  }

  storeImmediateIndU16(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = addWithOverflowU32(this.regs.getLowerU32(registerIndex), firstImmediateDecoder.getUnsigned());
    this.store(address, secondImmediateDecoder.getBytesAsLittleEndian().subarray(0, 2));
  }

  storeImmediateIndU32(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = addWithOverflowU32(this.regs.getLowerU32(registerIndex), firstImmediateDecoder.getUnsigned());
    this.store(address, secondImmediateDecoder.getBytesAsLittleEndian().subarray(0, 4));
  }

  storeImmediateIndU64(
    registerIndex: number,
    firstImmediateDecoder: ImmediateDecoder,
    secondImmediateDecoder: ImmediateDecoder,
  ) {
    const address = addWithOverflowU32(this.regs.getLowerU32(registerIndex), firstImmediateDecoder.getUnsigned());
    this.store(address, secondImmediateDecoder.getExtendedBytesAsLittleEndian());
  }

  private store(address: number, bytes: Uint8Array) {
    const storeResult = this.memory.storeFrom(tryAsMemoryIndex(address), bytes);
    if (storeResult.isOk) {
      return;
    }

    if (storeResult.error.hasPage) {
      this.instructionResult.status = Result.FAULT;
      this.instructionResult.exitParam = getStartPageIndex(storeResult.error.address);
    } else {
      this.instructionResult.status = Result.FAULT_ACCESS;
    }
  }
}
