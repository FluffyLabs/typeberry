import type { BytesBlob } from "@typeberry/bytes";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import type { BigGas, Memory, Registers } from "@typeberry/pvm-interpreter";
import type { Status } from "@typeberry/pvm-interpreter/status";
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
export type MachineInstance = Opaque<
  {
    /** `p`: Code - PVM code */
    code: BytesBlob;
    /** `u`: Memory - RAM */
    memory: Memory;
    /** `i`: Program counter - entry point */
    entrypoint: U64;
  },
  "MachineInstance"
>;

export const MachineInstance = {
  /** Create a new machine instance. */
  create(code: BytesBlob, memory: Memory, entrypoint: U64): MachineInstance {
    return asOpaqueType({ code, memory, entrypoint });
  },
};

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
  programCounter: U64;
  gas: BigGas;
  registers: Registers;
  memory: Memory;
};
