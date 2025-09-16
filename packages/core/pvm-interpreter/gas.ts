import { tryAsU32, tryAsU64, type U32, type U64 } from "@typeberry/numbers";
import { asOpaqueType, type Opaque } from "@typeberry/utils";

/** Gas measuring type. Can be either U64 or U32 for performance reasons. */
export type Gas = BigGas | SmallGas;
/** A U64 version of `Gas`. */
export type BigGas = Opaque<U64, "BigGas[U64]">;
/** A U32 version of `Gas`. */
export type SmallGas = Opaque<U32, "SmallGas[U32]">;

/** Attempt to convert given number into U32 gas representation. */
export const tryAsSmallGas = (v: number): SmallGas => asOpaqueType(tryAsU32(v));

/** Attempt to convert given number into U64 gas representation. */
export const tryAsBigGas = (v: number | bigint): BigGas => asOpaqueType(tryAsU64(v));

/** Attempt to convert given number into gas. */
export const tryAsGas = (v: number | bigint): Gas =>
  typeof v === "number" && v < 2 ** 32 ? tryAsSmallGas(v) : tryAsBigGas(v);

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

  /** Overwrite remaining gas. Prefer sub method instead. */
  set(g: Gas): void;

  /** Returns true if there was an underflow. */
  sub(g: Gas): boolean;
}

class GasCounterU64 implements GasCounter {
  constructor(private gas: U64) {}

  set(g: Gas) {
    this.gas = tryAsU64(g);
  }

  get() {
    return tryAsGas(this.gas);
  }

  sub(g: Gas) {
    const result = this.gas - tryAsU64(g);
    if (result >= 0n) {
      this.gas = tryAsU64(result);
      return false;
    }
    this.gas = tryAsU64(0n);
    return true;
  }
}
