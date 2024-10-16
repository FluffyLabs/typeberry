import { type Opaque, check } from "@typeberry/utils";

/** Regular array that has known, but not verified length. */
export type KnownSizeArray<T, F extends string> = Opaque<T[], F>;

/** An array with a known, fixed size. */
export class FixedSizeArray<T, N extends number> extends Array<T> {
  public constructor(data: T[], len: N) {
    check(data.length === len, `Expected an array of size: ${len}, got: ${data.length}`);
    super();
    this.push(...data);
    Object.seal(this);
  }
}
