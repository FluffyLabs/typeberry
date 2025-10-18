import type {
  __Record50 as BlockGasCost,
  __Record48 as Chunks,
  __Record46 as Pages,
  __Internref26 as Program,
  __Internref42 as StandardProgram,
  __Record55 as VmOutput,
} from "@fluffylabs/anan-as/raw";

export type AnanasAPI = {
  /** Exported memory */
  memory: WebAssembly.Memory;
  /**
   * assembly/api-internal/getAssembly
   * @param p `assembly/program/Program`
   * @returns `~lib/string/String`
   */
  getAssembly(p: Program): string;
  /**
   * assembly/program-build/wrapAsProgram
   * @param bytecode `~lib/typedarray/Uint8Array`
   * @returns `~lib/typedarray/Uint8Array`
   */
  wrapAsProgram(bytecode: Uint8Array): Uint8Array;
  /**
   * assembly/api-debugger/resetJAM
   * @param program `~lib/array/Array<u8>`
   * @param pc `f64`
   * @param initialGas `i64`
   * @param args `~lib/array/Array<u8>`
   * @param hasMetadata `bool`
   */
  resetJAM(program: number[], pc: number, initialGas: bigint, args: number[], hasMetadata?: boolean): void;
  /**
   * assembly/api-debugger/resetGeneric
   * @param program `~lib/array/Array<u8>`
   * @param flatRegisters `~lib/array/Array<u8>`
   * @param initialGas `i64`
   * @param hasMetadata `bool`
   */
  resetGeneric(program: number[], flatRegisters: number[], initialGas: bigint, hasMetadata?: boolean): void;
  /**
   * assembly/api-debugger/resetGenericWithMemory
   * @param program `~lib/array/Array<u8>`
   * @param flatRegisters `~lib/array/Array<u8>`
   * @param pageMap `~lib/typedarray/Uint8Array`
   * @param chunks `~lib/typedarray/Uint8Array`
   * @param initialGas `i64`
   * @param hasMetadata `bool`
   */
  resetGenericWithMemory(
    program: number[],
    flatRegisters: number[],
    pageMap: Uint8Array,
    chunks: Uint8Array,
    initialGas: bigint,
    hasMetadata?: boolean,
  ): void;
  /**
   * assembly/api-debugger/nextStep
   * @returns `bool`
   */
  nextStep(): boolean;
  /**
   * assembly/api-debugger/nSteps
   * @param steps `u32`
   * @returns `bool`
   */
  nSteps(steps: number): boolean;
  /**
   * assembly/api-debugger/getProgramCounter
   * @returns `u32`
   */
  getProgramCounter(): number;
  /**
   * assembly/api-debugger/setNextProgramCounter
   * @param pc `u32`
   */
  setNextProgramCounter(pc: number): void;
  /**
   * assembly/api-debugger/getStatus
   * @returns `u8`
   */
  getStatus(): number;
  /**
   * assembly/api-debugger/getExitArg
   * @returns `u32`
   */
  getExitArg(): number;
  /**
   * assembly/api-debugger/getGasLeft
   * @returns `i64`
   */
  getGasLeft(): bigint;
  /**
   * assembly/api-debugger/setGasLeft
   * @param gas `i64`
   */
  setGasLeft(gas: bigint): void;
  /**
   * assembly/api-debugger/getRegisters
   * @returns `~lib/typedarray/Uint8Array`
   */
  getRegisters(): Uint8Array;
  /**
   * assembly/api-debugger/setRegisters
   * @param flatRegisters `~lib/array/Array<u8>`
   */
  setRegisters(flatRegisters: number[]): void;
  /**
   * assembly/api-debugger/getPageDump
   * @param index `u32`
   * @returns `~lib/typedarray/Uint8Array`
   */
  getPageDump(index: number): Uint8Array;
  /**
   * assembly/api-debugger/getMemory
   * @param address `u32`
   * @param length `u32`
   * @returns `~lib/typedarray/Uint8Array`
   */
  getMemory(address: number, length: number): Uint8Array;
  /**
   * assembly/api-debugger/setMemory
   * @param address `u32`
   * @param data `~lib/typedarray/Uint8Array`
   */
  setMemory(address: number, data: Uint8Array): void;
  /**
   * assembly/api-utils/getGasCosts
   * @param input `~lib/array/Array<u8>`
   * @param kind `i32`
   * @param withMetadata `i32`
   * @returns `~lib/array/Array<assembly/gas-costs/BlockGasCost>`
   */
  getGasCosts(input: number[], kind: number, withMetadata: number): BlockGasCost<never>[];
  /**
   * assembly/api-utils/disassemble
   * @param input `~lib/array/Array<u8>`
   * @param kind `i32`
   * @param withMetadata `i32`
   * @returns `~lib/string/String`
   */
  disassemble(input: number[], kind: number, withMetadata: number): string;
  /**
   * assembly/api-utils/prepareProgram
   * @param kind `i32`
   * @param hasMetadata `i32`
   * @param program `~lib/array/Array<u8>`
   * @param initialRegisters `~lib/array/Array<u64>`
   * @param initialPageMap `~lib/array/Array<assembly/api-internal/InitialPage>`
   * @param initialMemory `~lib/array/Array<assembly/api-internal/InitialChunk>`
   * @param args `~lib/array/Array<u8>`
   * @returns `assembly/spi/StandardProgram`
   */
  prepareProgram(
    kind: number,
    hasMetadata: number,
    program: number[],
    initialRegisters: bigint[],
    initialPageMap: Pages<undefined>[],
    initialMemory: Chunks<undefined>[],
    args: number[],
  ): StandardProgram;
  /**
   * assembly/api-utils/runProgram
   * @param program `assembly/spi/StandardProgram`
   * @param initialGas `i64`
   * @param programCounter `u32`
   * @param logs `bool`
   * @param useSbrkGas `bool`
   * @returns `assembly/api-internal/VmOutput`
   */
  runProgram(
    program: StandardProgram,
    initialGas?: bigint,
    programCounter?: number,
    logs?: boolean,
    useSbrkGas?: boolean,
  ): VmOutput<never>;
};
