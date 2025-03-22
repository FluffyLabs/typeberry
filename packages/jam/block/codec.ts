import { type Descriptor, type SequenceView, codec } from "@typeberry/codec";
import { FixedSizeArray, type KnownSizeArray } from "@typeberry/collections";
import { ChainSpec, fullChainSpec } from "@typeberry/config";

/**
 * Helper function to declare a codec descriptor that depends on the context.
 */
export function codecWithContext<T, V>(cb: (ctx: ChainSpec) => Descriptor<T, V>): Descriptor<T, V> {
  const { name, sizeHint } = cb(fullChainSpec);
  return codec.select(
    {
      name,
      sizeHint: { bytes: sizeHint.bytes, isExact: false },
    },
    (context: unknown) => {
      if (context instanceof ChainSpec) {
        return cb(context);
      }
      if (context != null) {
        throw new Error(`[${name}] Unexpected context type ${typeof context} while encoding/decoding.`);
      }
      throw new Error(`[${name}] Missing context while encoding/decoding!`);
    },
  );
}

/** Codec for a known-size array with length validation. */
export const codecKnownSizeArray = <F extends string, T, V>(
  val: Descriptor<T, V>,
  options: codec.SequenceVarLenOptions,
  _id?: F,
): Descriptor<KnownSizeArray<T, F>, SequenceView<T, V>> => {
  return codec.sequenceVarLen(val, options).asOpaque();
};

/** Codec for a fixed-size array with length validation. */
export const codecFixedSizeArray = <N extends number, T, V>(
  val: Descriptor<T, V>,
  len: N,
): Descriptor<FixedSizeArray<T, N>> => {
  const checkLength = (actual: number) => {
    if (len !== actual) {
      throw new Error(`[${val.name}] Invalid size of fixed-size array. Got ${actual}, expected: ${len}`);
    }
  };

  return codec.sequenceFixLen(val, len).convert(
    (i) => {
      checkLength(i.length);
      return i;
    },
    (o) => {
      checkLength(o.length);
      return FixedSizeArray.new(o, len);
    },
  );
};
