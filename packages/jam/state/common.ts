import { withContext } from "@typeberry/block/context";
import { type Descriptor, type SequenceView, codec } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { type ChainSpec, EST_CORES } from "@typeberry/config";
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
export const codecPerCore = <T, V>(val: Descriptor<T, V>): Descriptor<PerCore<T>, SequenceView<T, V>> =>
  codec.select(
    {
      name: `PerCore<${val.name}>`,
      sizeHint: { bytes: Math.ceil(EST_CORES / 8), isExact: false },
    },
    withContext(`PerCore<${val.name}>`, (context) => {
      return codec.sequenceFixLen(val, context.coresCount).asOpaque();
    }),
  );
