import { type Opaque, check } from "@typeberry/utils";

export type KnownSizeArray<T, F extends string> = Opaque<T[], F>;

export class FixedSizeArray<T, N extends number> extends Array<T> {
  public constructor(data: T[], len: N) {
    check(data.length === len, `Expected an array of size: ${len}, got: ${data.length}`);
    super();
    this.push(...data);
    Object.seal(this);
  }
}
