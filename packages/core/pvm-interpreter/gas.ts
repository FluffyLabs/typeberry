import { tryAsU64, type U64 } from "@typeberry/numbers";
import { type Gas, type IGasCounter, tryAsGas } from "@typeberry/pvm-interface";

/** Create a new gas counter instance depending on the gas value. */
export function gasCounter(gas: Gas): IGasCounter {
  return new GasCounterU64(tryAsU64(gas));
}

class GasCounterU64 implements IGasCounter {
  initialGas: Gas;

  constructor(private gas: U64) {
    this.initialGas = tryAsGas(gas);
  }

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

  used(): Gas {
    const gasConsumed = tryAsU64(this.initialGas) - this.gas;

    if (gasConsumed < 0) {
      return this.initialGas;
    }

    return tryAsGas(gasConsumed);
  }
}
