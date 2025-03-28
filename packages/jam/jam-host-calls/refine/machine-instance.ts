import type { BytesBlob } from "@typeberry/bytes";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import type { BigGas, Memory, Registers } from "@typeberry/pvm-interpreter";
import { Status } from "@typeberry/pvm-interpreter/status";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/**
 * Machine - integrated PVM type
 * https://graypaper.fluffylabs.dev/#/85129da/2d1e002d1f00?v=0.6.3
 */

/** Running PVM instance identifier. */
export type MachineId = Opaque<U64, "MachineId[U64]">;
/** Convert a number into PVM instance identifier. */
export const tryAsMachineId = (v: number | bigint): MachineId => asOpaqueType(tryAsU64(v));

/** `M`: Machine instance */
export interface MachineInterface {
  /** `p`: Code - Generic PVM program */
  code: BytesBlob;
  /** `u`: Memory - RAM */
  memory: Memory;
  /** `i`: Program counter - entry point */
  entrypoint: U64;
  /** Execute the machine with given gas and registers. */
  run(gas: BigGas, registers: Registers): Promise<MachineResult>;
}

export class MachineInstance implements MachineInterface {
  code: BytesBlob;
  memory: Memory;
  entrypoint: U64;

  constructor(code: BytesBlob, memory: Memory, entrypoint: U64) {
    this.code = code;
    this.memory = memory;
    this.entrypoint = entrypoint;
  }

  async run(gas: BigGas, registers: Registers): Promise<MachineResult> {
    return {
      result: {
        status: Status.OK,
      },
      gas,
      registers,
    };
  }
}

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

/** Data returned by a machine invocation. */
export type MachineResult = {
  result: MachineStatus;
  gas: BigGas;
  registers: Registers;
};
