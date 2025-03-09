import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { asOpaqueType, check } from "@typeberry/utils";

/** One entry of kind `T` for each core. */
export type PerCore<T> = KnownSizeArray<T, "number of cores">;
/** Check if given array has correct length before casting to the opaque type. */
export function tryAsPerCore<T>(array: T[], spec: ChainSpec): PerCore<T> {
  check(
    array.length === spec.coresCount,
    `Invalid per-core array length. Expected ${spec.coresCount}, got: ${array.length}`,
  );
  return asOpaqueType(array);
}
