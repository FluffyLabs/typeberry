import { type IRegisters, NO_OF_REGISTERS, REGISTER_BYTE_SIZE } from "@typeberry/pvm-interface";

const TOTAL_BYTES = NO_OF_REGISTERS * REGISTER_BYTE_SIZE; // 13 * 8 = 104

/**
 * High-performance register file using dual-view typed arrays on a shared ArrayBuffer.
 *
 * Key optimization: setU32 does sign extension to 64 bits WITHOUT BigInt.
 * Writing to Int32Array (value + sign fill) is visible through BigUint64Array overlay.
 */
export class Registers implements IRegisters {
  private readonly buf: ArrayBuffer;
  readonly u64: BigUint64Array;
  readonly i64: BigInt64Array;
  readonly u32: Uint32Array;
  readonly i32: Int32Array;
  readonly bytes: Uint8Array;

  constructor() {
    this.buf = new ArrayBuffer(TOTAL_BYTES);
    this.u64 = new BigUint64Array(this.buf);
    this.i64 = new BigInt64Array(this.buf);
    this.u32 = new Uint32Array(this.buf);
    this.i32 = new Int32Array(this.buf);
    this.bytes = new Uint8Array(this.buf);
  }

  // ---- 32-bit fast path (Number, no BigInt) ----

  getU32(i: number): number {
    return this.u32[i << 1]; // low 32 bits
  }

  getI32(i: number): number {
    return this.i32[i << 1]; // low 32 bits, sign-extended by JS engine
  }

  /**
   * Set 32-bit value with sign extension to 64-bit. NO BigInt involved.
   *
   * PVM spec: every 32-bit operation sign-extends the result to full 64 bits.
   * We write to Int32Array: low word = value, high word = sign fill (0 or -1).
   * Because Int32Array and BigUint64Array share the same ArrayBuffer,
   * reading via getU64/getI64 sees the correct sign-extended value.
   */
  setU32(i: number, v: number): void {
    const idx = i << 1;
    this.i32[idx] = v; // low 32 bits
    this.i32[idx + 1] = v >> 31; // high 32 bits = sign fill
  }

  // ---- 64-bit path (BigInt, unavoidable) ----

  getU64(i: number): bigint {
    return this.u64[i];
  }

  getI64(i: number): bigint {
    return this.i64[i];
  }

  setU64(i: number, v: bigint): void {
    this.u64[i] = BigInt.asUintN(64, v);
  }

  setI64(i: number, v: bigint): void {
    this.i64[i] = v;
  }

  // ---- IRegisters interface ----

  getAllEncoded(): Uint8Array {
    return this.bytes;
  }

  setAllEncoded(bytes: Uint8Array): void {
    this.bytes.set(bytes);
  }

  // ---- bulk / debug ----

  reset(): void {
    this.bytes.fill(0);
  }

  copyFromOld(regs: IRegisters): void {
    const encoded = regs.getAllEncoded();
    this.bytes.set(encoded);
  }

  copyFrom(other: Registers): void {
    this.bytes.set(other.bytes);
  }
}
