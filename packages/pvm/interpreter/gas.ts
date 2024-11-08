import { type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";

export type Gas = BigGas | SmallGas;
export type BigGas = Opaque<U64, "BigGas[U64]">;
export type SmallGas = Opaque<U32, "SmallGas[U32]">;

/** Create a new gas counter instance depending on the gas value. */
export function gasCounter(gas: Gas): GasCounter {
  return new GasCounterU64(tryAsU64(gas));
}

/** An abstraction over gas counter.
 *
 * It can be optimized to use numbers instead of bigint in case of small gas.
 */
export interface GasCounter {
  /** Return remaining gas. */
  get(): Gas;

  /** Overwite remaining gas. Prefer sub method instead. */
  set(g: Gas): void;

  /** Returns true if there was an underflow. */
  sub(g: SmallGas): boolean;
}

class GasCounterU64 implements GasCounter {
  constructor(private gas: U64) {}

  set(g: Gas) {
    this.gas = tryAsU64(g);
  }

  get() {
    return this.gas as Gas;
  }

  sub(g: SmallGas) {
    // TODO [ToDr] This should rather be I64?
    this.gas = (this.gas - tryAsU64(g)) as U64;
    return this.gas < 0n;
  }
}
