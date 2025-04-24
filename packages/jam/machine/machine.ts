import { BytesBlob } from "@typeberry/bytes";
import { ProgramCounter } from "@typeberry/jam-host-calls/refine/refine-externalities";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import { type BigGas, type Registers, type Memory, Interpreter } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/**
 * Machine - integrated PVM type
 * https://graypaper.fluffylabs.dev/#/68eaa1f/2d58002d5800?v=0.6.4
 */

/** Running PVM instance identifier. */
export type MachineId = Opaque<U64, "MachineId[u64]">;
/** Convert a number into PVM instance identifier. */
export const tryAsMachineId = (v: number | bigint): MachineId => asOpaqueType(tryAsU64(v));

/** Machines id -> machine instance */
export type Machines = Map<MachineId, MachineInstance>;

export const MACHINES: Machines = new Map();

export enum MachineErrorCode {
  /** Machine not found. */
  NOT_FOUND = 1,
  /** Invalid machine ID. */
  INVALID_ID = 2,
  /** Machine already exists. */
  ALREADY_EXISTS = 3,
}

/** Possible machine statuses. */
export type MachineStatus =
  | {
      status: typeof Status.HOST;
      hostCallIndex: U64;
    }
  | {
      status: typeof Status.FAULT;
      address: U64;
    }
  | {
      status: typeof Status.OK | typeof Status.HALT | typeof Status.PANIC | typeof Status.OOG;
    };

/** `M`: Machine instance */
export interface MachineInterface {
  /** `p` : Program code */
  code: BytesBlob;
  /** `u`: Memory - RAM */
  memory: Memory | null;
  /** `i`: Program counter - entry point */
  entrypoint: ProgramCounter;
  /** Execute the machine with given gas and registers. */
  run(gas: BigGas, registers: Registers): Promise<MachineResult>;
}

export class MachineInstance implements MachineInterface {
  memory: Memory | null;
  code: BytesBlob;
  entrypoint: ProgramCounter;

  private constructor(
    code: BytesBlob,
    memory: Memory | null,
    entrypoint: ProgramCounter,
  ) {
    this.code = code;
    this.memory = memory;
    this.entrypoint = entrypoint;
  }

  static withCodeAndProgramCounter(
    code: BytesBlob,
    entrypoint: ProgramCounter,
  ): MachineInstance {
    return new MachineInstance(code, null, entrypoint);
  }

  async run(gas: BigGas, registers: Registers): Promise<MachineResult> {
    if (this.memory === null) {
      throw new Error("Memory is not initialized");
    }

    const interpreter = new Interpreter();
    interpreter.reset(this.code.raw, this.entrypoint, gas);

    return {
      result: {
        status: Status.OK,
      },
      gas,
      registers,
    };
  }
}

/** Data returned by a machine invocation. */
export type MachineResult = {
  result: MachineStatus;
  gas: BigGas;
  registers: Registers;
};