import { Descriptor, type SequenceView, TYPICAL_DICTIONARY_LENGTH, codec } from "@typeberry/codec";
import { FixedSizeArray, HashDictionary, type KnownSizeArray } from "@typeberry/collections";
import { ChainSpec, fullChainSpec } from "@typeberry/config";
import type { OpaqueHash } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { Comparator } from "@typeberry/ordering";

/**
 * Helper function to declare a codec descriptor that depends on the context.
 *
 * NOTE: the returned values are cached based on the `ChainSpec` reference.
 */
export function codecWithContext<T, V>(chooser: (ctx: ChainSpec) => Descriptor<T, V>): Descriptor<T, V> {
  const defaultContext = fullChainSpec;
  const { name, sizeHint } = chooser(defaultContext);
  const cache = new Map<ChainSpec, Descriptor<T, V>>();
  return codec.select(
    {
      name,
      sizeHint: { bytes: sizeHint.bytes, isExact: false },
    },
    (context: unknown) => {
      if (context instanceof ChainSpec) {
        const cached = cache.get(context);
        if (cached !== undefined) {
          return cached;
        }
        const ret = chooser(context);
        cache.set(context, ret);
        return ret;
      }
      // resolving with default context.
      if (context === null) {
        return chooser(defaultContext);
      }
      // invalid context type
      if (context !== null) {
        throw new Error(`[${name}] Unexpected context type ${typeof context} while encoding/decoding.`);
      }
      throw new Error(`[${name}] Missing context while encoding/decoding!`);
    },
  );
}

/** Codec for a known-size array with length validation. */
export const codecKnownSizeArray = <F extends string, T, V>(
  val: Descriptor<T, V>,
  options: codec.SequenceVarLenOptions | { fixedLength: number },
  _id?: F,
): Descriptor<KnownSizeArray<T, F>, SequenceView<T, V>> => {
  if ("fixedLength" in options) {
    return codec.sequenceFixLen(val, options.fixedLength).asOpaque();
  }
  return codec.sequenceVarLen(val, options).asOpaque();
};

/** Codec for a fixed-size array with length validation. */
export const codecFixedSizeArray = <N extends number, T, V>(
  val: Descriptor<T, V>,
  len: N,
): Descriptor<FixedSizeArray<T, N>, SequenceView<T>> => {
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

export type CodecHashDictionaryOptions<T> = {
  typicalLength?: number;
  compare?: Comparator<T>;
};
/** Codec for a hash-dictionary. */
export const codecHashDictionary = <K extends OpaqueHash, T>(
  value: Descriptor<T>,
  extractKey: (val: T) => K,
  {
    typicalLength = TYPICAL_DICTIONARY_LENGTH,
    compare = (a, b) => extractKey(a).compare(extractKey(b)),
  }: CodecHashDictionaryOptions<T> = {},
): Descriptor<HashDictionary<K, T>> => {
  return Descriptor.new(
    `HashDictionary<${value.name}>[?]`,
    {
      bytes: typicalLength * value.sizeHint.bytes,
      isExact: false,
    },
    (e, v) => {
      const data = Array.from(v.values());
      data.sort((a, b) => compare(a, b).value);

      e.varU32(tryAsU32(data.length));

      for (const v of data) {
        value.encode(e, v);
      }
    },
    (d) => {
      const map = HashDictionary.new<K, T>();
      const len = d.varU32();
      let prevValue = null as null | T;
      for (let i = 0; i < len; i += 1) {
        const v = value.decode(d);
        const k = extractKey(v);
        if (map.has(k)) {
          throw new Error(`Duplicate item in the dictionary encoding: "${k}"!`);
        }
        if (prevValue !== null && compare(prevValue, v).isGreaterOrEqual()) {
          throw new Error(`The keys in dictionary encoding are not sorted "${prevValue}" >= "${v}"!`);
        }
        map.set(k, v);
        prevValue = v;
      }
      return map;
    },
    (s) => {
      const len = s.decoder.varU32();
      s.sequenceFixLen(value, len);
    },
  );
};
