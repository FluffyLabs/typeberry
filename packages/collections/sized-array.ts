import { type Opaque, asOpaqueType, check, inspect } from "@typeberry/utils";

/** Regular array that has known, but not verified length. */
export type KnownSizeArray<T, F extends string> = Opaque<T[], F>;

/** Converts a regular array into a `KnownSizeArray`. */
export function asKnownSize<T, F extends string>(data: T[]): KnownSizeArray<T, F> {
  return asOpaqueType(data);
}

/** An array with a known, fixed size. */
export class FixedSizeArray<T, N extends number> extends Array<T> {
  public readonly fixedLength: N;

  private constructor(...args: T[]) {
    // NOTE [ToDr] we know this is going to be set corrrectly,
    // because the constructor is private (it has to be for things like `map`
    // to work correctly) and we only invoke it in the `new` static function.
    if (args.length === 1 && typeof args[0] === "number") {
      // handling the special case when the only item is a number (n) and hence would create an array of n undefined entries
      super(1);
      this[0] = args[0];
    } else {
      super(...args);
    }
    this.fixedLength = args.length as N;
  }

  static new<T, N extends number>(data: T[], len: N): FixedSizeArray<T, N> {
    check(data.length === len, `Expected an array of size: ${len}, got: ${data.length}`);
    const arr = new FixedSizeArray<T, N>(...data);
    Object.seal(arr);
    return arr;
  }

  toString() {
    return inspect(Array.from(this), false);
  }
}
