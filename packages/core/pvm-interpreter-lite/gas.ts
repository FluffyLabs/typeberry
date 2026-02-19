import { type Gas, type IGasCounter, tryAsGas } from "@typeberry/pvm-interface";

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Fast gas counter using JS Number instead of BigInt.
 *
 * For gas values <= MAX_SAFE_INTEGER (2^53 - 1), this uses pure Number arithmetic.
 * subOne() is a single decrement + comparison.
 *
 * This implementation does NOT support gas > MAX_SAFE_INTEGER.
 * Use BigGasCounter for that case (via createGasCounter with forceBigGas).
 */
export class FastGasCounter implements IGasCounter {
  private counter: number;
  initialGas: Gas;

  constructor(gas: Gas) {
    this.initialGas = gas;
    this.counter = Number(gas);
  }

  /** Old model: every instruction costs 1. Ultra-fast. */
  subOne(): boolean {
    return --this.counter < 0;
  }

  sub(g: Gas): boolean {
    this.counter -= Number(g);
    if (this.counter < 0) {
      this.counter = 0;
      return true;
    }
    return false;
  }

  get(): Gas {
    return tryAsGas(this.counter);
  }

  /**
   * FastGasCounter does not support set() — it cannot safely handle values > MAX_SAFE_INTEGER.
   * Use BigGasCounter (via createGasCounter with forceBigGas) if you need set().
   */
  set(_g: Gas): void {
    throw new Error("FastGasCounter.set() is not supported. Use createGasCounter with forceBigGas for debugger mode.");
  }

  used(): Gas {
    return tryAsGas(Number(this.initialGas) - this.counter);
  }
}

/**
 * Gas counter supporting the full i64 range (up to 2^64 - 1).
 *
 * Strategy: gas only decreases, so we split it into:
 *   - `counter` (Number): holds up to MAX_SAFE_INTEGER worth of gas
 *   - `overflow` (bigint): holds the portion above MAX_SAFE_INTEGER
 *
 * subOne() decrements `counter`. When `counter` reaches 0 and there's
 * overflow remaining, we refill `counter` from `overflow`. This means
 * the hot path (subOne) is still a single Number decrement in the vast
 * majority of cases - the BigInt refill only happens once every ~9e15 instructions.
 *
 * NOTE: This counter is slightly slower than FastGasCounter because of the
 * extra `counter < 0` branch that checks overflow. In benchmarks, this adds
 * approximately 1-2ns per instruction. Use FastGasCounter when gas fits in Number.
 */
export class BigGasCounter implements IGasCounter {
  private counter: number;
  private overflow: bigint;
  initialGas: Gas;

  constructor(gas: Gas) {
    this.initialGas = gas;
    const bigVal = BigInt(gas);
    if (bigVal <= MAX_SAFE_INTEGER_BIGINT) {
      this.counter = Number(bigVal);
      this.overflow = 0n;
    } else {
      this.counter = Number.MAX_SAFE_INTEGER;
      this.overflow = bigVal - MAX_SAFE_INTEGER_BIGINT;
    }
  }

  subOne(): boolean {
    if (--this.counter >= 0) {
      return false;
    }
    // counter went below 0 - check if we can refill from overflow
    return this.refillOrExhaust();
  }

  /** Slow path: called when counter underflows. Refills from overflow or signals OOG. */
  private refillOrExhaust(): boolean {
    if (this.overflow > 0n) {
      // Refill counter from overflow
      if (this.overflow >= MAX_SAFE_INTEGER_BIGINT) {
        this.counter = Number.MAX_SAFE_INTEGER;
        this.overflow -= MAX_SAFE_INTEGER_BIGINT;
      } else {
        this.counter = Number(this.overflow);
        this.overflow = 0n;
      }
      return false; // not exhausted
    }
    // Truly out of gas
    this.counter = 0;
    return true;
  }

  sub(g: Gas): boolean {
    const bigCost = BigInt(g);
    if (bigCost <= MAX_SAFE_INTEGER_BIGINT) {
      const cost = Number(bigCost);
      this.counter -= cost;
      if (this.counter >= 0) {
        return false;
      }
      // Counter went negative - deficit is |counter|
      const deficit = -this.counter;
      this.counter = 0;
      if (this.overflow > 0n) {
        const bigDeficit = BigInt(deficit);
        if (this.overflow >= bigDeficit) {
          this.overflow -= bigDeficit;
          return false;
        }
      }
      return true;
    }
    // Cost is larger than MAX_SAFE_INTEGER - full BigInt path
    const total = BigInt(this.counter) + this.overflow;
    if (total < bigCost) {
      this.counter = 0;
      this.overflow = 0n;
      return true;
    }
    const remaining = total - bigCost;
    if (remaining <= MAX_SAFE_INTEGER_BIGINT) {
      this.counter = Number(remaining);
      this.overflow = 0n;
    } else {
      this.counter = Number.MAX_SAFE_INTEGER;
      this.overflow = remaining - MAX_SAFE_INTEGER_BIGINT;
    }
    return false;
  }

  get(): Gas {
    const total = BigInt(this.counter) + this.overflow;
    return tryAsGas(total);
  }

  set(g: Gas): void {
    const bigVal = BigInt(g);
    if (bigVal <= MAX_SAFE_INTEGER_BIGINT) {
      this.counter = Number(bigVal);
      this.overflow = 0n;
    } else {
      this.counter = Number.MAX_SAFE_INTEGER;
      this.overflow = bigVal - MAX_SAFE_INTEGER_BIGINT;
    }
  }

  used(): Gas {
    const remaining = BigInt(this.counter) + this.overflow;
    const initial = BigInt(this.initialGas);
    return tryAsGas(initial - remaining);
  }
}

/**
 * Create the appropriate gas counter for the given gas amount.
 *
 * By default uses FastGasCounter for values <= MAX_SAFE_INTEGER, BigGasCounter otherwise.
 *
 * @param forceBigGas - Force BigGasCounter regardless of gas value. Required for debugger
 *   mode where gas.set() may be called with arbitrary values at runtime.
 */
export function createGasCounter(gas: Gas, forceBigGas = false): IGasCounter & { subOne(): boolean } {
  if (!forceBigGas && BigInt(gas) <= MAX_SAFE_INTEGER_BIGINT) {
    return new FastGasCounter(gas);
  }
  return new BigGasCounter(gas);
}
