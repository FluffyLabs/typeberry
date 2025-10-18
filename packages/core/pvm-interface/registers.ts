import type { U64 } from "@typeberry/numbers";

export interface IRegisters {
  get(registerIndex: number): U64;
  set(registerIndex: number, value: U64): void;
}
