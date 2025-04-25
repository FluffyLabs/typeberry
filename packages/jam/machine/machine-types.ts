import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { BigGas, Registers } from "@typeberry/pvm-interpreter";
import type { Status } from "@typeberry/pvm-interpreter/status";
import { type Opaque, asOpaqueType } from "@typeberry/utils";

/** Machine ID type */
export type MachineId = Opaque<U64, "MachineId[u64]">;

/** Convert a number into a Machine ID */
export const tryAsMachineId = (v: number | bigint): MachineId => asOpaqueType(tryAsU64(v));

/** Machine error codes */
export enum MachineErrorCode {
  NOT_FOUND = 1,
  ALREADY_EXISTS = 2,
}

/** Possible machine statuses */
export type MachineStatus =
  | {
      status: typeof Status.HOST;
      hostCallIndex: U64;
    }
  | {
      status: typeof Status.FAULT;
      address: U32;
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
