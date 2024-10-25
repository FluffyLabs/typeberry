import {U32, U64} from "@typeberry/numbers";
import {Opaque, WithOpaque} from "@typeberry/utils";

export type Gas = Opaque<U32 | U64, "Gas">;
export type SmallGas = Opaque<U32, "SmallGas">;

export function gasCounter(gas: Gas): GasCounter {
  return new GasCounterU64(BigInt(gas) as U64);
}

export interface GasCounter {
  /** Returns true if there was an overflow. */
  add(g: SmallGas): void;

  /** Returns true if there was an underflow. */
  sub(g: SmallGas): boolean;

  get(): Gas;
}

export class GasCounterU64 implements GasCounter {
  constructor(private gas: U64) {}

  get(): Gas {
    return this.gas as Gas;
  }

  add(g: SmallGas): boolean {
    this.gas = this.gas + BigInt(g) as U64;
    // TODO [ToDr] Overflow
    return false;
  }
  sub(g: SmallGas): boolean {
    this.gas = this.gas - BigInt(g) as U64;
    return this.gas < 0n;
  }
}
