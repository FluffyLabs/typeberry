import { type Opaque, type TokenOf, asOpaqueType, check, inspect } from "@typeberry/utils";

/** A collection that has a known, but not necessarily verified size. */
export type KnownSize<T, F extends string> = Opaque<T, F>;

/** Id of the known size collection. */
export type KnownSizeId<X> = X extends KnownSizeArray<infer _T, infer F> ? F : never;

/** Regular array that has known, but not verified length. */
export type KnownSizeArray<T, F extends string> = KnownSize<T[], F>;

/** Converts a regular collection into a `KnownSize`. */
export function asKnownSize<R, T>(data: T): KnownSize<T, TokenOf<R, T>> {
  return asOpaqueType(data);
}

/** An array with a known, fixed size. */
export class FixedSizeArray<T, N extends number> extends Array<T> {
  public readonly fixedLength: N;

  private constructor(len: N);
  private constructor(...data: T[]) {
    super(...data);
    // NOTE [ToDr] we know this is going to be set corrrectly,
    // because the constructor is private (it has to be for things like `map`
    // to work correctly) and we only invoke it in the `new` static function.
    this.fixedLength = this.length as N;
  }

  static new<T, N extends number>(data: T[], len: N): FixedSizeArray<T, N> {
    check(data.length === len, `Expected an array of size: ${len}, got: ${data.length}`);

    const arr = new FixedSizeArray<T, N>(len);

    for (let i = 0; i < len; i++) {
      arr[i] = data[i];
    }

    Object.seal(arr);
    return arr;
  }

  static fill<T, N extends number>(generator: (idx: number) => T, len: N): FixedSizeArray<T, N> {
    const data: T[] = [];
    for (let i = 0; i < len; i++) {
      data.push(generator(i));
    }
    return FixedSizeArray.new(data, len);
  }

  toString() {
    return inspect(Array.from(this), false);
  }
}
