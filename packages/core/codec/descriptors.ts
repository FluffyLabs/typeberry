import { type BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { type U8, type U16, type U32, type U64, tryAsU32 } from "@typeberry/numbers";
import { type Opaque, asOpaqueType } from "@typeberry/utils";
import type { Decode, Decoder } from "./decoder";
import { type Encode, type Encoder, type SizeHint, addSizeHints } from "./encoder";
import { type Skip, Skipper } from "./skip";
import { type LengthRange, validateLength } from "./validation";
import { ObjectView, SequenceView, type ViewField, type ViewOf } from "./view";

/**
 * For sequences with unknown length we need to give some size hint.
 * TODO [ToDr] [opti] This value should be updated when we run some real-data bechmarks.
 */
const TYPICAL_SEQUENCE_LENGTH = 64;
/**
 * For the size hint for encoding typical dictionaries.
 * TODO [ToDr] [opti] This value should be updated when we run some real-data bechmarks.
 */
export const TYPICAL_DICTIONARY_LENGTH = 32;

/**
 * A full codec type, i.e. the `Encode` and `Decode`.
 */
export type Codec<T> = Encode<T> & Decode<T>;

/**
 * Type descriptor definition.
 *
 * The type descriptor can encode & decode given type `T`, but
 * also have a `name` and a byte-size hint.
 *
 * Descriptors can be composed to form more complex typings.
 */
export class Descriptor<T, V = T> implements Codec<T>, Skip {
  /** A "lightweight" version of the object. */
  public readonly View: Descriptor<V>;

  /** New descriptor with specialized `View`. */
  public static withView<T, V>(
    name: string,
    sizeHint: SizeHint,
    encode: Descriptor<T, V>["encode"],
    decode: Descriptor<T, V>["decode"],
    skip: Descriptor<T, V>["skip"],
    view: Descriptor<V>,
  ) {
    return new Descriptor(name, sizeHint, encode, decode, skip, view);
  }

  /** Create a new descriptor without a specialized `View`. */
  public static new<T>(
    name: string,
    sizeHint: SizeHint,
    encode: Descriptor<T>["encode"],
    decode: Descriptor<T>["decode"],
    skip: Descriptor<T>["skip"],
  ) {
    return new Descriptor(name, sizeHint, encode, decode, skip, null);
  }

  private constructor(
    /** Descriptive name of the coded data. */
    public readonly name: string,
    /** A byte size hint for encoded data. */
    public readonly sizeHint: SizeHint,
    /** Encoding function. */
    public readonly encode: (e: Encoder, elem: T) => void,
    /** Decoding function. */
    public readonly decode: (d: Decoder) => T,
    /** Skipping function. */
    public readonly skip: (s: Skipper) => void,
    /** view object. It can be `null` iff T===V. */
    view: Descriptor<V> | null,
  ) {
    // We cast here to make sure that the field is always set.
    this.View = view ?? (this as unknown as Descriptor<V>);
  }

  /**
   * Extract an encoded version of this type from the decoder.
   *
   * This function skips the object instead of decoding it,
   * allowing to retrieve the encoded portion of the object from `Decoder`.
   */
  public skipEncoded(decoder: Decoder) {
    const initBytes = decoder.bytesRead();
    this.skip(new Skipper(decoder));
    const endBytes = decoder.bytesRead();
    return BytesBlob.blobFrom(decoder.source.subarray(initBytes, endBytes));
  }

  /** Return a new descriptor that converts data into some other type. */
  public convert<F>(input: (i: F) => T, output: (i: T) => F): Descriptor<F, V> {
    return new Descriptor(
      this.name,
      this.sizeHint,
      (e: Encoder, elem: F) => this.encode(e, input(elem)),
      (d: Decoder) => output(this.decode(d)),
      this.skip,
      this.View,
    );
  }

  /** Safely cast the descriptor value to a opaque type. */
  public asOpaque<Token extends string>() {
    return this.convert<Opaque<T, Token>>(
      (i) => i,
      (o) => asOpaqueType(o),
    );
  }
}

/** Infer the type that is described by given descriptor `T` */
export type DescribedBy<T> = T extends Descriptor<infer V> ? V : never;

/**
 * Converts a class `T` into an object with the same fields as the class.
 */
export type CodecRecord<T> = {
  [K in PropertyKeys<T>]: T[K];
};

/**
 * Same as `CodecRecord<T>`, but the fields are all optional.
 */
type OptionalRecord<T> = {
  [K in PropertyKeys<T>]?: T[K];
};

/**
 * `Descriptor` of a complex type of some class with a bunch of public fields.
 */
export type DescriptorRecord<T> = {
  [K in PropertyKeys<T>]: Descriptor<T[K], unknown>;
};

/**
 * Simplified `DescriptorRecord`, where all keys must be used as descriptor keys.
 */
type SimpleDescriptorRecord<T> = {
  [K in keyof T]: Descriptor<T[K], unknown>;
};

/** Only keys that contain properties, not methods. */
export type PropertyKeys<T> = {
  // biome-ignore lint/complexity/noBannedTypes: We want to skip any function-like types here.
  [K in Extract<keyof T, string>]: T[K] extends Function ? never : K;
}[Extract<keyof T, string>];

/** A constructor of basic data object that takes a `Record<T>`. */
export type ClassConstructor<T> = {
  name: string;
  fromCodec: (o: CodecRecord<T>) => T;
};

function exactHint(bytes: number): SizeHint {
  return {
    bytes,
    isExact: true,
  };
}

/** Descriptors for data types that can be read/written from/to codec. */
export namespace codec {
  /** Fixed-length bytes sequence. */
  export const bytes = (() => {
    const cache = new Map<number, unknown>();
    return <N extends number>(len: N): Descriptor<Bytes<N>> => {
      let ret = cache.get(len) as Descriptor<Bytes<N>>;
      if (ret === undefined) {
        ret = Descriptor.new<Bytes<N>>(
          `Bytes<${len}>`,
          exactHint(len),
          (e, v) => e.bytes(v),
          (d) => d.bytes(len),
          (s) => s.bytes(len),
        );
        cache.set(len, ret);
      }
      return ret;
    };
  })();

  /** Variable-length U32. */
  export const varU32 = Descriptor.new<U32>(
    "var_u32",
    { bytes: 4, isExact: false },
    (e, v) => e.varU32(v),
    (d) => d.varU32(),
    (d) => d.varU32(),
  );

  /** Variable-length U64. */
  export const varU64 = Descriptor.new<U64>(
    "var_u64",
    { bytes: 8, isExact: false },
    (e, v) => e.varU64(v),
    (d) => d.varU64(),
    (d) => d.varU64(),
  );

  /** Unsigned 64-bit number. */
  export const u64 = Descriptor.withView<U64, Bytes<8>>(
    "u64",
    exactHint(8),
    (e, v) => e.i64(v),
    (d) => d.u64(),
    (d) => d.u64(),
    codec.bytes(8),
  );

  /** Unsigned 32-bit number. */
  export const u32 = Descriptor.withView<U32, Bytes<4>>(
    "u32",
    exactHint(4),
    (e, v) => e.i32(v),
    (d) => d.u32(),
    (d) => d.u32(),
    codec.bytes(4),
  );

  /** Unsigned 24-bit number. */
  export const u24 = Descriptor.withView<number, Bytes<3>>(
    "u24",
    exactHint(3),
    (e, v) => e.i24(v),
    (d) => d.u24(),
    (d) => d.u24(),
    codec.bytes(3),
  );

  /** Unsigned 16-bit number. */
  export const u16 = Descriptor.withView<U16, Bytes<2>>(
    "u16",
    exactHint(2),
    (e, v) => e.i16(v),
    (d) => d.u16(),
    (d) => d.u16(),
    codec.bytes(2),
  );

  /** Unsigned 8-bit number. */
  export const u8 = Descriptor.new<U8>(
    "u8",
    exactHint(1),
    (e, v) => e.i8(v),
    (d) => d.u8(),
    (d) => d.u8(),
  );

  /** Signed 64-bit number. */
  export const i64 = Descriptor.withView<bigint, Bytes<8>>(
    "u64",
    exactHint(8),
    (e, v) => e.i64(v),
    (d) => d.i64(),
    (s) => s.u64(),
    codec.bytes(8),
  );

  /** Signed 32-bit number. */
  export const i32 = Descriptor.withView<number, Bytes<4>>(
    "i32",
    exactHint(4),
    (e, v) => e.i32(v),
    (d) => d.i32(),
    (s) => s.u32(),
    codec.bytes(4),
  );

  /** Signed 24-bit number. */
  export const i24 = Descriptor.withView<number, Bytes<3>>(
    "i24",
    exactHint(3),
    (e, v) => e.i24(v),
    (d) => d.i24(),
    (s) => s.u24(),
    codec.bytes(3),
  );

  /** Signed 16-bit number. */
  export const i16 = Descriptor.withView<number, Bytes<2>>(
    "i16",
    exactHint(2),
    (e, v) => e.i16(v),
    (d) => d.i16(),
    (s) => s.u16(),
    codec.bytes(2),
  );

  /** Signed 8-bit number. */
  export const i8 = Descriptor.new<number>(
    "i8",
    exactHint(1),
    (e, v) => e.i8(v),
    (d) => d.i8(),
    (s) => s.u8(),
  );

  /** 1-byte boolean value. */
  export const bool = Descriptor.new<boolean>(
    "bool",
    exactHint(1),
    (e, v) => e.bool(v),
    (d) => d.bool(),
    (s) => s.bool(),
  );

  /** Just dump the entire blob as-is. */
  export const dump = Descriptor.new<BytesBlob>(
    "Dump",
    { bytes: TYPICAL_SEQUENCE_LENGTH, isExact: false },
    (e, v) => e.bytes(Bytes.fromBlob(v.raw, v.raw.length)),
    (d) => BytesBlob.blobFrom(d.bytes(d.source.length - d.bytesRead()).raw),
    (s) => s.bytes(s.decoder.source.length - s.decoder.bytesRead()),
  );

  /** Variable-length bytes blob. */
  export const blob = Descriptor.new<BytesBlob>(
    "BytesBlob",
    { bytes: TYPICAL_SEQUENCE_LENGTH, isExact: false },
    (e, v) => e.bytesBlob(v),
    (d) => d.bytesBlob(),
    (s) => s.bytesBlob(),
  );

  /** String encoded as variable-length bytes blob. */
  export const string = Descriptor.withView<string, BytesBlob>(
    "string",
    { bytes: TYPICAL_SEQUENCE_LENGTH, isExact: false },
    (e, v) => e.bytesBlob(BytesBlob.blobFrom(new TextEncoder().encode(v))),
    (d) => new TextDecoder("utf8", { fatal: true }).decode(d.bytesBlob().raw),
    (s) => s.bytesBlob(),
    codec.blob,
  );

  /** Variable-length bit vector. */
  export const bitVecVarLen = Descriptor.new<BitVec>(
    "BitVec[?]",
    { bytes: TYPICAL_SEQUENCE_LENGTH >>> 3, isExact: false },
    (e, v) => e.bitVecVarLen(v),
    (d) => d.bitVecVarLen(),
    (s) => s.bitVecVarLen(),
  );

  /** Fixed-length bit vector. */
  export const bitVecFixLen = (bitLen: number) =>
    Descriptor.new<BitVec>(
      `BitVec[${bitLen}]`,
      exactHint(bitLen >>> 3),
      (e, v) => e.bitVecFixLen(v),
      (d) => d.bitVecFixLen(bitLen),
      (s) => s.bitVecFixLen(bitLen),
    );

  /** Optionality wrapper for given type. */
  export const optional = <T, V>(type: Descriptor<T, V>): Descriptor<T | null, V | null> => {
    const self = Descriptor.new<T | null>(
      `Optional<${type.name}>`,
      addSizeHints({ bytes: 1, isExact: false }, type.sizeHint),
      (e, v) => e.optional(type, v),
      (d) => d.optional(type),
      (s) => s.optional(type),
    );

    if (hasUniqueView(type)) {
      return Descriptor.withView(
        self.name,
        self.sizeHint,
        self.encode,
        self.decode,
        self.skip,
        codec.optional(type.View),
      );
    }

    return self;
  };

  export type SequenceVarLenOptions = LengthRange & {
    typicalLength?: number;
  };

  /** Variable-length sequence of given type. */
  export const sequenceVarLen = <T, V = T>(
    type: Descriptor<T, V>,
    options: SequenceVarLenOptions = {
      minLength: 0,
      maxLength: 2 ** 32 - 1,
    },
  ) => {
    const name = `Sequence<${type.name}>[?]`;
    const typicalLength = options.typicalLength ?? TYPICAL_SEQUENCE_LENGTH;
    return Descriptor.withView<T[], SequenceView<T, V>>(
      name,
      { bytes: typicalLength * type.sizeHint.bytes, isExact: false },
      (e, v) => {
        validateLength(options, v.length, name);
        e.sequenceVarLen(type, v);
      },
      (d) => {
        const len = d.varU32();
        validateLength(options, len, name);
        return d.sequenceFixLen(type, len);
      },
      (s) => {
        const len = s.decoder.varU32();
        validateLength(options, len, name);
        return s.sequenceFixLen(type, len);
      },
      sequenceViewVarLen(type, options),
    );
  };

  /** Fixed-length sequence of given type. */
  export const sequenceFixLen = <T, V = T>(type: Descriptor<T, V>, len: number) =>
    Descriptor.withView<T[], SequenceView<T, V>>(
      `Sequence<${type.name}>[${len}]`,
      { bytes: len * type.sizeHint.bytes, isExact: type.sizeHint.isExact },
      (e, v) => e.sequenceFixLen(type, v),
      (d) => d.sequenceFixLen(type, len),
      (s) => s.sequenceFixLen(type, len),
      sequenceViewFixLen(type, { fixedLength: len }),
    );

  /** Small dictionary codec. */
  export const dictionary = <K, V, V2>(
    key: Descriptor<K>,
    value: Descriptor<V, V2>,
    {
      sortKeys,
      fixedLength,
    }: {
      sortKeys: (a: K, b: K) => number;
      fixedLength?: number;
    },
  ): Descriptor<Map<K, V>, Map<K, V2>> => {
    const self = Descriptor.new<Map<K, V>>(
      `Dictionary<${key.name}, ${value.name}>[${fixedLength ?? "?"}]`,
      {
        bytes:
          fixedLength !== undefined
            ? fixedLength * addSizeHints(key.sizeHint, value.sizeHint).bytes
            : TYPICAL_DICTIONARY_LENGTH * (addSizeHints(key.sizeHint, value.sizeHint).bytes ?? 0),
        isExact: fixedLength !== undefined ? key.sizeHint.isExact && value.sizeHint.isExact : false,
      },
      (e, v) => {
        const data = Array.from(v.entries());
        data.sort((a, b) => sortKeys(a[0], b[0]));

        // length prefix
        if (fixedLength === undefined || fixedLength === 0) {
          e.varU32(tryAsU32(data.length));
        }
        for (const [k, v] of data) {
          key.encode(e, k);
          value.encode(e, v);
        }
      },
      (d) => {
        const map = new Map<K, V>();
        const len = fixedLength ?? d.varU32();
        let prevKey = null as null | K;
        for (let i = 0; i < len; i += 1) {
          const k = key.decode(d);
          const v = value.decode(d);
          if (map.has(k)) {
            throw new Error(`Duplicate item in the dictionary encoding: "${k}"!`);
          }
          if (prevKey !== null && sortKeys(prevKey, k) >= 0) {
            throw new Error(`The keys in dictionary encoding are not sorted "${prevKey}" >= "${k}"!`);
          }
          map.set(k, v);
          prevKey = k;
        }
        return map;
      },
      (s) => {
        const len = fixedLength ?? s.decoder.varU32();
        s.sequenceFixLen(key, len);
        s.sequenceFixLen(value, len);
      },
    );

    if (hasUniqueView(value)) {
      return Descriptor.withView(
        self.name,
        self.sizeHint,
        self.encode,
        self.decode,
        self.skip,
        codec.dictionary(key, value.View, { sortKeys, fixedLength }),
      );
    }

    return self;
  };

  /** Custom encoding / decoding logic. */
  export const custom = <T>(
    {
      name,
      sizeHint = { bytes: 0, isExact: false },
    }: {
      name: string;
      sizeHint: SizeHint;
    },
    encode: (e: Encoder, x: T) => void,
    decode: (d: Decoder) => T,
    skip: (s: Skipper) => void,
  ): Descriptor<T> => Descriptor.new(name, sizeHint, encode, decode, skip);

  /** Choose a descriptor depending on the encoding/decoding context. */
  export const select = <T, V = T>(
    {
      name,
      sizeHint,
    }: {
      name: string;
      sizeHint: SizeHint;
    },
    chooser: (ctx: unknown | null) => Descriptor<T, V>,
  ): Descriptor<T, V> =>
    Descriptor.withView(
      name,
      sizeHint,
      (e, x) => chooser(e.getContext()).encode(e, x),
      (d) => chooser(d.getContext()).decode(d),
      (s) => chooser(s.decoder.getContext()).skip(s),
      chooser(null).View,
    );

  /**
   * A descriptor for a more complex POJO.
   *
   * This descriptor is very similar to `Class`, but it DOES NOT maintain the
   * prototype chain of the resulting object - we only care about the shape of
   * the object here.
   */
  export const object = <T>(
    descriptors: SimpleDescriptorRecord<T>,
    name = "object",
    fromCodec: (o: CodecRecord<T>) => T = (o) => o as T,
  ) => {
    return Class({ name, fromCodec }, descriptors);
  };

  /**
   * A descriptor for a more complex class type.
   *
   * The resulting descriptor is able to encode & decode all of the public fields of
   * the class, given the map of descriptors for each one of them.
   *
   * The resulting decoded object will be an instance of given `Class` unlike simpler,
   * shape-based `object` method.
   */
  export const Class = <T, D extends DescriptorRecord<T> = DescriptorRecord<T>>(
    Class: ClassConstructor<T>,
    descriptors: D,
  ): Descriptor<T, ViewOf<T, D>> => {
    // Calculate a size hint for this class.
    let sizeHint = exactHint(0);
    forEachDescriptor(descriptors, (_k, val) => {
      sizeHint = addSizeHints(sizeHint, val.sizeHint);
    });

    const skipper = (s: Skipper) => {
      // optimized case for fixed size complex values.
      if (sizeHint.isExact) {
        return s.decoder.skip(sizeHint.bytes);
      }
      forEachDescriptor(descriptors, (_key, descriptor) => {
        descriptor.skip(s);
      });
    };

    const view = objectView(Class, descriptors, sizeHint, skipper);

    // and create the descriptor for the entire class.
    return Descriptor.withView<T, ViewOf<T, D>>(
      Class.name,
      sizeHint,
      (e, t) => {
        forEachDescriptor(descriptors, (key, descriptor) => {
          const value = t[key];
          descriptor.encode(e, value);
        });
      },
      (d) => {
        const constructorParams: OptionalRecord<T> = {};
        forEachDescriptor(descriptors, (key, descriptor) => {
          const value = descriptor.decode(d);
          constructorParams[key] = value;
        });
        return Class.fromCodec(constructorParams as CodecRecord<T>);
      },
      skipper,
      view,
    );
  };
}

/** Typesafe iteration of every descriptor in the record object. */
export function forEachDescriptor<T>(
  descriptors: DescriptorRecord<T>,
  f: <K extends keyof DescriptorRecord<T>>(key: K, val: Descriptor<T[K]>) => void,
) {
  for (const key in descriptors) {
    if (typeof key === "string" && key in descriptors) {
      const k = key as keyof DescriptorRecord<T>;
      f(k, descriptors[k]);
    }
  }
}

/** A utility function to break an infinite recursion when resolving View types. */
function hasUniqueView<T, V>(a: Descriptor<T, V>) {
  return a.View !== (a as unknown);
}

function objectView<T, D extends DescriptorRecord<T>>(
  Class: ClassConstructor<T>,
  descriptors: D,
  sizeHint: SizeHint,
  skipper: Skip["skip"],
): Descriptor<ViewOf<T, D>> {
  // Create a View, based on the `AbstractView`.
  class ClassView extends ObjectView<T> {
    constructor(d: Decoder) {
      super(d, Class, descriptors);
    }
  }

  // We need to dynamically extend the prototype to add these extra lazy getters.
  forEachDescriptor(descriptors, (key) => {
    if (typeof key === "string") {
      // add method that returns a nested view.
      Object.defineProperty(ClassView.prototype, key, {
        get: function (this: ClassView): ViewField<unknown, unknown> {
          return this.get(key);
        },
      });
    }
  });

  return Descriptor.new(
    `View<${Class.name}>`,
    sizeHint,
    (e, t) => {
      const encoded = t.encoded();
      e.bytes(Bytes.fromBlob(encoded.raw, encoded.length));
    },
    (d) => {
      const view = new ClassView(d.clone()) as ViewOf<T, D>;
      skipper(new Skipper(d));
      return view;
    },
    skipper,
  );
}

function sequenceViewVarLen<T, V>(type: Descriptor<T, V>, options: LengthRange): Descriptor<SequenceView<T, V>> {
  const typeBytes = type.sizeHint.bytes;
  const sizeHint = { bytes: typeBytes * TYPICAL_SEQUENCE_LENGTH, isExact: false };
  const view = type.name !== type.View.name ? `, ${type.View.name}` : "";
  const name = `SeqView<${type.name}${view}>[?]`;

  const skipper = (s: Skipper) => {
    const length = s.decoder.varU32();
    validateLength(options, length, name);
    return s.sequenceFixLen(type, length);
  };

  return Descriptor.new(
    name,
    sizeHint,
    (e, t) => {
      validateLength(options, t.length, name);
      const encoded = t.encoded();
      e.bytes(Bytes.fromBlob(encoded.raw, encoded.length));
    },
    (d) => {
      const view = new SequenceView(d.clone(), type);
      skipper(new Skipper(d));
      return view;
    },
    skipper,
  );
}

function sequenceViewFixLen<T, V>(
  type: Descriptor<T, V>,
  { fixedLength }: { fixedLength: number },
): Descriptor<SequenceView<T, V>> {
  const typeBytes = type.sizeHint.bytes;
  const sizeHint = { bytes: typeBytes * fixedLength, isExact: type.sizeHint.isExact };

  const skipper = (s: Skipper) => s.sequenceFixLen(type, fixedLength);

  const view = type.name !== type.View.name ? `, ${type.View.name}` : "";
  const name = `SeqView<${type.name}${view}>[${fixedLength}]`;
  return Descriptor.new(
    name,
    sizeHint,
    (e, t) => {
      const encoded = t.encoded();
      e.bytes(Bytes.fromBlob(encoded.raw, encoded.length));
    },
    (d) => {
      const view = new SequenceView(d.clone(), type, fixedLength);
      skipper(new Skipper(d));
      return view;
    },
    skipper,
  );
}
