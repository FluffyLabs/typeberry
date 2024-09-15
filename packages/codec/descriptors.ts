import type { BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import { type Decode, Decoder } from "./decoder";
import type { Encode, Encoder } from "./encoder";

/**
 * For sequences with unknown length we need to give some size hint.
 * TODO [ToDr] [opti] This value should be updated when we run some real-data bechmarks.
 */
const TYPICAL_SEQUENCE_LENGTH = 64;

/**
 * A full codec type, i.e. the `Encode` and `Decode`.
 */
export type Codec<T> = Encode<T> & Decode<T>;

/**
 * Type descriptor defition.
 *
 * The type descriptor can encode & decode given type `T`, but
 * also have a `name` and a byte-size hint.
 *
 * Descriptors can be composed to form more complex typings.
 */
export type Descriptor<T> = {
  /** Descriptive name of the coded data. */
  name: string;
  /**
   * A hint about size of that type.
   *
   * Should be used when encoding to create long-enough destination.
   */
  sizeHintBytes: number;
} & Codec<T>;

/**
 * Converts a class `T` into an object with the same fields as the class.
 */
export type Record<T> = {
  [K in keyof T]: T[K];
};

/**
 * Converts a class `T` into an object with methods
 * with the same names and return values as the fields of that class.
 */
type LazyRecord<T> = {
  [K in keyof T]: () => T[K];
};

/**
 * Same as `Record<T>`, but the fields are all optional.
 */
type OptionalRecord<T> = {
  [K in keyof T]?: T[K];
};

/**
 * `Descriptor` of a complex type of some class with a bunch of public fields.
 */
type DescriptorRecord<T> = {
  [K in keyof T]: Descriptor<T[K]>;
};

/**
 * A `View` of some class `T`.
 *
 * The view is meant to represent a lazy-decodeable data object.
 * Instead of decoding the entire class `T` at once, we just
 * create a wrapper for [`Decoder`] that can decode all the fields
 * in a lazy fashion (i.e. only when they are needed).
 *
 * The fields are then cached, so multiple calls to the same data
 * are not paying the decoding cost.
 *
 * Note that due to how the codec works, `View`s are faster
 * only if you need to access some fields of the object that
 * are in the beginning of the encoding. In case you:
 * 1. Need to access all of the fields anyway.
 * 2. Or you need to access the last field.
 * the `View` will need to decode everything anyway, so
 * it makes more sense to decode that right away.
 *
 * A view can be converted into `T` at any point via [`AbstractView.materialize`]
 * method.
 */
export type View<T> = AbstractView<T> & LazyRecord<T>;

/** A constructor for the `View<T>`. */
type ViewConstructor<T> = {
  new (d: Decoder): View<T>;
  fromBytesBlob(bytes: BytesBlob): View<T>;
};

/** An extra `ViewConstructor` attached to some `Descriptor`. */
type WithView<T> = {
  View: ViewConstructor<T>;
};

/** A constructor of basic data object that takes a `Record<T>`. */
type ClassConstructor<T> = new (o: Record<T>) => T;

/** Variable-length U32. */
export const VAR_U32 = descriptor<number>(
  "var_u32",
  4,
  (e, v) => e.varU32(v),
  (d) => d.varU32(),
);

/** Variable-length U64. */
export const VAR_U64 = descriptor<bigint>(
  "var_u64",
  8,
  (e, v) => e.varU64(v),
  (d) => d.varU64(),
);

/** Unsigned 32-bit number. */
export const U32 = descriptor<number>(
  "u32",
  4,
  (e, v) => e.i32(v),
  (d) => d.u32(),
);

/** Unsigned 24-bit number. */
export const U24 = descriptor<number>(
  "u24",
  3,
  (e, v) => e.i24(v),
  (d) => d.u24(),
);

/** Unsigned 16-bit number. */
export const U16 = descriptor<number>(
  "u16",
  2,
  (e, v) => e.i16(v),
  (d) => d.u16(),
);

/** Unsigned 8-bit number. */
export const U8 = descriptor<number>(
  "u8",
  1,
  (e, v) => e.i8(v),
  (d) => d.u8(),
);

/** Signed 32-bit number. */
export const I32 = descriptor<number>(
  "i32",
  4,
  (e, v) => e.i32(v),
  (d) => d.i32(),
);

/** Signed 24-bit number. */
export const I24 = descriptor<number>(
  "i24",
  3,
  (e, v) => e.i24(v),
  (d) => d.i24(),
);

/** Signed 16-bit number. */
export const I16 = descriptor<number>(
  "i16",
  2,
  (e, v) => e.i16(v),
  (d) => d.i16(),
);

/** Signed 8-bit number. */
export const I8 = descriptor<number>(
  "i8",
  1,
  (e, v) => e.i8(v),
  (d) => d.i8(),
);

/** Variable-length bytes blob. */
export const BLOB = descriptor<BytesBlob>(
  "BytesBlob",
  TYPICAL_SEQUENCE_LENGTH,
  (e, v) => e.bytesBlob(v),
  (d) => d.bytesBlob(),
);

/** Fixed-length bytes sequence. */
export const BYTES = (() => {
  const cache = new Map<string, unknown>();
  return <N extends number>(len: N): Descriptor<Bytes<N>> => {
    const key = `${len}`;
    let ret = cache.get(key) as Descriptor<Bytes<N>>;
    if (!ret) {
      ret = descriptor<Bytes<N>>(
        `Bytes<${len}>`,
        len,
        (e, v) => e.bytes(v),
        (d) => d.bytes(len),
      );
      cache.set(key, ret);
    }
    return ret;
  };
})();

/** Variable-length bit vector. */
export const BITVEC_VAR_LEN = descriptor<BitVec>(
  "BitVec[?]",
  TYPICAL_SEQUENCE_LENGTH >>> 3,
  (e, v) => e.bitVecVarLen(v),
  (d) => d.bitVecVarLen(),
);

/** Fixed-length bit vector. */
export const BITVEC_FIX_LEN = (len: number) =>
  descriptor<BitVec>(
    `BitVec[${len}]`,
    len >>> 3,
    (e, v) => e.bitVecFixLen(v),
    (d) => d.bitVecFixLen(len),
  );

/** Optionality wrapper for given type. */
export const OPTIONAL = <T>(type: Descriptor<T>) =>
  descriptor<T | null>(
    `Optional<${type.name}>`,
    1 + type.sizeHintBytes,
    (e, v) => e.optional(type, v),
    (d) => d.optional(type),
  );

/** Variable-length sequence of given type. */
export const SEQUENCE_VAR_LEN = <T>(type: Descriptor<T>) =>
  descriptor<T[]>(
    `Sequence<${type.name}>[?]`,
    TYPICAL_SEQUENCE_LENGTH * type.sizeHintBytes,
    (e, v) => e.sequenceVarLen(type, v),
    (d) => d.sequenceVarLen(type),
  );

/** Fixed-length sequence of given type. */
export const SEQUENCE_FIX_LEN = <T>(type: Descriptor<T>, len: number) =>
  descriptor<T[]>(
    `Sequence<${type.name}>[${len}]`,
    len * type.sizeHintBytes,
    (e, v) => e.sequenceFixLen(type, v),
    (d) => d.sequenceFixLen(type, len),
  );

/**
 * A descriptor for a more complex class type.
 *
 * The resulting descriptor is able to encode & decode all of the public fields of
 * the class, given the map of descriptors for each one of them.
 *
 * Additionally a `View<T>` is generated, which allows partially-decoding these class
 * elements.
 */
export const CLASS = <T>(Class: ClassConstructor<T>, descriptors: DescriptorRecord<T>): Descriptor<T> & WithView<T> => {
  // Create a View, based on the `AbstractView`.
  class ClassView extends AbstractView<T> {
    constructor(d: Decoder) {
      super(d, Class, descriptors);
    }
  }
  // We need to dynamically extend the prototype to add these extra lazy getters.
  forEachDescriptor(descriptors, (key) => {
    if (typeof key === "string") {
      Object.defineProperty(ClassView.prototype, key, {
        value: function (this: ClassView) {
          return this.getOrDecode(key);
        },
      });
    }
  });

  // Also add a static builder method to avoid boilerplate.
  const ViewTyped = ClassView as ViewConstructor<T>;
  ViewTyped.fromBytesBlob = (bytes: BytesBlob) => new ViewTyped(Decoder.fromBytesBlob(bytes));

  // Calculate a size hint for this class.
  let sizeHintBytes = 0;
  forEachDescriptor(descriptors, (_k, val) => {
    sizeHintBytes += val.sizeHintBytes;
  });

  // and finally create the descriptor for the entire class.
  const desc = descriptor<T>(
    Class.name,
    sizeHintBytes,
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
      return new Class(constructorParams as Record<T>);
    },
  );

  return {
    View: ViewTyped,
    ...desc,
  };
};

const logger = Logger.new(__filename, "codec/descriptors");

/**
 * A base class for all the lazy views.
 */
abstract class AbstractView<T> {
  private lastDecodedIdx = -1;
  private readonly cache = new Map<string, unknown>();

  constructor(
    private readonly d: Decoder,
    protected readonly materializedConstructor: ClassConstructor<T>,
    protected readonly descriptors: DescriptorRecord<T>,
  ) {}

  /**
   * Create a concrete instance of `T` by decoding all of the remaining
   * fields that are not yet there in the cache.
   */
  public materialize(): T {
    const fields = Object.keys(this.descriptors);
    // make sure to fully populate the cache.
    if (this.lastDecodedIdx + 1 !== fields.length) {
      this.decodeUpTo(fields[fields.length - 1], false);
    }
    const constructorParams = Object.fromEntries(fields.map((key) => [key, this.cache.get(key)]));
    return new this.materializedConstructor(constructorParams as Record<T>);
  }

  /**
   * Decode all of the fields up to the given one and return the value for that field.
   *
   * NOTE: this method should not be called if the value is already in the cache!
   */
  private decodeUpTo(field: string, shouldWarn = true): unknown | undefined {
    let lastVal = undefined;
    const descriptorKeys = Object.keys(this.descriptors);
    const needIdx = descriptorKeys.findIndex((k) => k === field);
    check(
      this.lastDecodedIdx < needIdx,
      `Unjustified request to decode data: lastDecodedIdx: ${this.lastDecodedIdx}, need: ${needIdx}`,
    );

    for (let i = this.lastDecodedIdx + 1; i <= needIdx; i += 1) {
      const f = this.descriptors[descriptorKeys[i] as keyof DescriptorRecord<T>];
      const val = f.decode(this.d);
      this.cache.set(descriptorKeys[i], val);
      lastVal = val;
    }
    this.lastDecodedIdx = needIdx;
    if (shouldWarn && this.lastDecodedIdx + 1 === descriptorKeys.length) {
      logger.warn(
        `Decoded an entire object of class ${this.materializedConstructor.name}. You should rather materialize.`,
      );
    }
    return lastVal;
  }

  /**
   * Get the value of the field from cache or decode it.
   */
  protected getOrDecode(field: string): unknown {
    const cached = this.cache.get(field);
    return cached !== undefined ? cached : this.decodeUpTo(field);
  }
}

/** Typesafe iteration of every descriptor in the record object. */
function forEachDescriptor<T>(
  descriptors: DescriptorRecord<T>,
  f: <K extends keyof T>(key: K, val: Descriptor<T[K]>) => void,
) {
  for (const key in descriptors) {
    if (key in descriptors) {
      f(key, descriptors[key]);
    }
  }
}

/** Convenience method to create descriptors and avoid the superfluous typing. */
function descriptor<T>(
  name: string,
  sizeHintBytes: number,
  encode: (e: Encoder, elem: T) => void,
  decode: (d: Decoder) => T,
): Descriptor<T> {
  return {
    name,
    sizeHintBytes,
    encode,
    decode,
  };
}
