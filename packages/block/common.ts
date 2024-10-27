import type { Bytes } from "@typeberry/bytes";
import type { U16, U32, U64 } from "@typeberry/numbers";
import type { Opaque } from "@typeberry/utils";
import type { HASH_SIZE } from "./hash";

// TODO [ToDr] Move to HASH;
/** Opaque Blake2B. */
export type Blake2bHash = Bytes<32>;
/**
 * Time slot index.
 *
 * "an index of a six-second timeslots from the JAM Common Era"
 *
 * https://graypaper.fluffylabs.dev/#/387103d/0b1d000b2100
 */
export type TimeSlot = Opaque<U32, "TimeSlot[u32]">;
/** Index of the validator in current validators set. */
export type ValidatorIndex = Opaque<U16, "ValidatorIndex[u16]">;
/** Unique service identifier. */
export type ServiceId = Opaque<U32, "ServiceId[u32]">;
/** Service gas - a measure of execution time/complexity. */
export type ServiceGas = Opaque<U64, "Gas[u64]">;
/** `eta`: epoch randomness */
export type EntropyHash = Opaque<Blake2bHash, "EntropyHash">;

/**
 * Index of an epoch.
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/0b20000b2300
 */
export type Epoch = Opaque<U32, "Epoch">;

/** A class that adds `toString` method to debug the model. */
export abstract class WithDebug {
  toString() {
    const nest = (v: string) =>
      v
        .split("\n")
        .map((x) => `  ${x}`)
        .join("\n")
        .trim();
    const asStr = (v: unknown) => {
      if (v === null) {
        return "<null>";
      }
      if (v === undefined) {
        return "<undefined>";
      }
      if (Array.isArray(v)) {
        return `[${v}]`;
      }
      return `${v}`;
    };
    let v = `${this.constructor.name} {`;
    const keys = Object.keys(this);
    const oneLine = keys.length < 3;
    for (const k of keys) {
      if (typeof k === "string") {
        v += oneLine ? "" : "\n  ";
        v += `${k}: ${nest(asStr(this[k as keyof WithDebug]))}`;
        v += oneLine ? "," : "";
      }
    }
    v += oneLine ? "}" : "\n}";
    return v;
  }
}

export class WithHash<THash extends Bytes<typeof HASH_SIZE>, TData> extends WithDebug {
  constructor(
    public readonly hash: THash,
    public readonly data: TData,
  ) {
    super();
  }
}
