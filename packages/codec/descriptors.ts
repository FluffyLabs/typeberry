import { type BitVec, type Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import type { U8, U16, U32, U64 } from "@typeberry/numbers";
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
export class Descriptor<T> implements Codec<T> {
  public constructor(
    /** Descriptive name of the coded data. */
    public name: string,
    /** A byte size hint for encoded data. */
    public sizeHintBytes: number,
    /** Encoding function. */
    public encode: (e: Encoder, elem: T) => void,
    /** Decoding function. */
    public decode: (d: Decoder) => T,
  ) {}

  /** Return a new descriptor that converts data into some other type. */
  public convert<F>(input: (i: F) => T, output: (i: T) => F): Descriptor<F> {
    return new Descriptor(
      this.name,
      this.sizeHintBytes,
      (e: Encoder, elem: F) => this.encode(e, input(elem)),
      (d: Decoder) => output(this.decode(d)),
    );
  }

  public cast<F extends T>() {
    return this.convert<F>(
      (i) => i,
      (o) => o as F,
    );
  }
}

const VIEW_FIELD = "View";

/**
 * A more sophisticated descriptor for an object that represents a record (aka class).
 *
 * The second optional generic parameter is there to specialise the `record` type
 * in case it's required for nested views.
 */
export class ClassDescriptor<T, D extends DescriptorRecord<T> = DescriptorRecord<T>> extends Descriptor<T> {
  /** A lazy view of the class (if any). */
  [VIEW_FIELD]: ViewConstructor<T, KeysWithView<T, D>>;

  public constructor(desc: Descriptor<T>, view: ViewConstructor<T, KeysWithView<T, D>>) {
    super(desc.name, desc.sizeHintBytes, desc.encode, desc.decode);
    this[VIEW_FIELD] = view;
  }
}

/**
 * Converts a class `T` into an object with the same fields as the class.
 */
export type CodecRecord<T> = {
  [K in PropertyKeys<T>]: T[K];
};

/**
 * Converts a class `T` into an object with methods
 * with the same names and return values as the fields of that class.
 */
type LazyRecord<T> = {
  [K in PropertyKeys<T>]: () => T[K];
};

/**
 * Convers a class `T` into an object with `*View` methods
 * only for keys `NestedViewKeys`, returning a `View` objects.
 */
type ViewRecord<T, NestedViewKeys extends keyof T> = {
  [K in NestedViewKeys as `${K & string}${typeof VIEW_FIELD}`]: <N extends ViewConstructor<T[K], never>>() => ViewOf<N>;
};

function viewMethod(key: string) {
  return `${key}${VIEW_FIELD}`;
}

/**
 * Same as `CodecRecord<T>`, but the fields are all optional.
 */
type OptionalRecord<T> = {
  [K in PropertyKeys<T>]?: T[K];
};

/**
 * `Descriptor` of a complex type of some class with a bunch of public fields.
 */
type DescriptorRecord<T> = {
  [K in PropertyKeys<T>]: Descriptor<T[K]> | ClassDescriptor<T[K]>;
};

/** Only keys that contain properties, not methods. */
export type PropertyKeys<T> = {
  // biome-ignore lint/complexity/noBannedTypes: We want to skip any function-like types here.
  [K in Extract<keyof T, string>]: T[K] extends Function ? never : K;
}[Extract<keyof T, string>];

type KeysWithView<T, D extends DescriptorRecord<T>> = {
  [K in PropertyKeys<T>]: D[K] extends ClassDescriptor<T[K], infer _> ? K : never;
}[PropertyKeys<T>];

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
export type View<T, NestedViewKeys extends keyof T = never> = AbstractView<T> &
  LazyRecord<T> &
  ViewRecord<T, NestedViewKeys>;

/** A constructor for the `View<T>`. */
type ViewConstructor<T, NestedViewKeys extends keyof T> = {
  new (d: Decoder): View<T, NestedViewKeys>;
  fromBytesBlob(bytes: BytesBlob | Uint8Array, context?: unknown): View<T, NestedViewKeys>;
};

/** Extract the view type given the constructor. */
type ViewOf<C> = C extends ViewConstructor<infer T, infer N> ? View<T, N> : never;

/** A constructor of basic data object that takes a `Record<T>`. */
type ClassConstructor<T> = {
  name: string;
  fromCodec: (o: CodecRecord<T>) => T;
};

/** Descriptors for data types that can be read/written from/to codec. */
export namespace codec {
  /** Variable-length U32. */
  export const varU32 = descriptor<U32>(
    "var_u32",
    4,
    (e, v) => e.varU32(v),
    (d) => d.varU32(),
  );

  /** Variable-length U64. */
  export const varU64 = descriptor<U64>(
    "var_u64",
    8,
    (e, v) => e.varU64(v),
    (d) => d.varU64(),
  );

  /** Unsigned 64-bit number. */
  export const u64 = descriptor<U64>(
    "u64",
    8,
    (e, v) => e.i64(v),
    (d) => d.u64(),
  );

  /** Unsigned 32-bit number. */
  export const u32 = descriptor<U32>(
    "u32",
    4,
    (e, v) => e.i32(v),
    (d) => d.u32(),
  );

  /** Unsigned 24-bit number. */
  export const u24 = descriptor<number>(
    "u24",
    3,
    (e, v) => e.i24(v),
    (d) => d.u24(),
  );

  /** Unsigned 16-bit number. */
  export const u16 = descriptor<U16>(
    "u16",
    2,
    (e, v) => e.i16(v),
    (d) => d.u16(),
  );

  /** Unsigned 8-bit number. */
  export const u8 = descriptor<U8>(
    "u8",
    1,
    (e, v) => e.i8(v),
    (d) => d.u8(),
  );

  /** Signed 64-bit number. */
  export const i64 = descriptor<bigint>(
    "u64",
    8,
    (e, v) => e.i64(v),
    (d) => d.i64(),
  );

  /** Signed 32-bit number. */
  export const i32 = descriptor<number>(
    "i32",
    4,
    (e, v) => e.i32(v),
    (d) => d.i32(),
  );

  /** Signed 24-bit number. */
  export const i24 = descriptor<number>(
    "i24",
    3,
    (e, v) => e.i24(v),
    (d) => d.i24(),
  );

  /** Signed 16-bit number. */
  export const i16 = descriptor<number>(
    "i16",
    2,
    (e, v) => e.i16(v),
    (d) => d.i16(),
  );

  /** Signed 8-bit number. */
  export const i8 = descriptor<number>(
    "i8",
    1,
    (e, v) => e.i8(v),
    (d) => d.i8(),
  );

  /** 1-byte boolean value. */
  export const bool = descriptor<boolean>(
    "bool",
    1,
    (e, v) => e.bool(v),
    (d) => d.bool(),
  );

  /** String encoded as variable-length bytes blob. */
  export const string = descriptor<string>(
    "string",
    TYPICAL_SEQUENCE_LENGTH,
    (e, v) => e.bytesBlob(BytesBlob.from(new TextEncoder().encode(v))),
    (d) => new TextDecoder("utf8", { fatal: true }).decode(d.bytesBlob().buffer),
  );

  /** Variable-length bytes blob. */
  export const blob = descriptor<BytesBlob>(
    "BytesBlob",
    TYPICAL_SEQUENCE_LENGTH,
    (e, v) => e.bytesBlob(v),
    (d) => d.bytesBlob(),
  );

  /** Fixed-length bytes sequence. */
  export const bytes = (() => {
    const cache = new Map<number, unknown>();
    return <N extends number>(len: N): Descriptor<Bytes<N>> => {
      let ret = cache.get(len) as Descriptor<Bytes<N>>;
      if (!ret) {
        ret = descriptor<Bytes<N>>(
          `Bytes<${len}>`,
          len,
          (e, v) => e.bytes(v),
          (d) => d.bytes(len),
        );
        cache.set(len, ret);
      }
      return ret;
    };
  })();

  /** Variable-length bit vector. */
  export const bitVecVarLen = descriptor<BitVec>(
    "BitVec[?]",
    TYPICAL_SEQUENCE_LENGTH >>> 3,
    (e, v) => e.bitVecVarLen(v),
    (d) => d.bitVecVarLen(),
  );

  /** Fixed-length bit vector. */
  export const bitVecFixLen = (len: number) =>
    descriptor<BitVec>(
      `BitVec[${len}]`,
      len >>> 3,
      (e, v) => e.bitVecFixLen(v),
      (d) => d.bitVecFixLen(len),
    );

  /** Optionality wrapper for given type. */
  export const optional = <T>(type: Descriptor<T>) =>
    descriptor<T | null>(
      `Optional<${type.name}>`,
      1 + (type.sizeHintBytes ?? 0),
      (e, v) => e.optional(type, v),
      (d) => d.optional(type),
    );

  /** Variable-length sequence of given type. */
  export const sequenceVarLen = <T>(type: Descriptor<T>) =>
    descriptor<T[]>(
      `Sequence<${type.name}>[?]`,
      TYPICAL_SEQUENCE_LENGTH * (type.sizeHintBytes ?? 0),
      (e, v) => e.sequenceVarLen(type, v),
      (d) => d.sequenceVarLen(type),
    );

  /** Fixed-length sequence of given type. */
  export const sequenceFixLen = <T>(type: Descriptor<T>, len: number) =>
    descriptor<T[]>(
      `Sequence<${type.name}>[${len}]`,
      len * (type.sizeHintBytes ?? 0),
      (e, v) => e.sequenceFixLen(type, v),
      (d) => d.sequenceFixLen(type, len),
    );

  /** Custom encoding / decoding logic. */
  export const custom = <T>(
    {
      name,
      sizeHintBytes = 0,
    }: {
      name: string;
      sizeHintBytes: number;
    },
    encode: (e: Encoder, x: T) => void,
    decode: (d: Decoder) => T,
  ): Descriptor<T> => descriptor(name, sizeHintBytes, encode, decode);

  /** Choose a descriptor depending on the encoding/decoding context. */
  export const select = <T>(
    {
      name,
      sizeHintBytes = 0,
    }: {
      name: string;
      sizeHintBytes: number;
    },
    chooser: (ctx: unknown) => Descriptor<T>,
  ): Descriptor<T> =>
    custom(
      {
        name,
        sizeHintBytes,
      },
      (e, x) => chooser(e.getContext()).encode(e, x),
      (d) => chooser(d.getContext()).decode(d),
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
  export const Class = <T, D extends DescriptorRecord<T>>(
    Class: ClassConstructor<T>,
    descriptors: D,
  ): ClassDescriptor<T, D> => {
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

        if (VIEW_FIELD in descriptors[key]) {
          // add view method.
          Object.defineProperty(ClassView.prototype, viewMethod(key), {
            value: function (this: ClassView) {
              return this.getOrDecodeView(key);
            },
          });
        }
      }
    });

    // Also add a static builder method to avoid boilerplate.
    const ViewTyped = ClassView as ViewConstructor<T, KeysWithView<T, D>>;
    ViewTyped.fromBytesBlob = (bytes: BytesBlob | Uint8Array, context?: unknown) => {
      const decoder = bytes instanceof Uint8Array ? Decoder.fromBlob(bytes) : Decoder.fromBytesBlob(bytes);
      decoder.attachContext(context);
      return new ViewTyped(decoder);
    };

    // Calculate a size hint for this class.
    let sizeHintBytes = 0;
    forEachDescriptor(descriptors, (_k, val) => {
      sizeHintBytes += val.sizeHintBytes ?? 0;
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
        return Class.fromCodec(constructorParams as CodecRecord<T>);
      },
    );

    return new ClassDescriptor(desc, ViewTyped);
  };
}

const logger = Logger.new(__filename, "codec/descriptors");

/**
 * A base class for all the lazy views.
 */
abstract class AbstractView<T> {
  private lastDecodedIdx = -1;
  private readonly cache = new Map<keyof T, T[keyof T]>();
  private readonly viewCache = new Map<keyof T, View<T[keyof T]>>();

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
    const fields = Object.keys(this.descriptors) as (keyof T)[];
    // make sure to fully populate the cache.
    if (this.lastDecodedIdx + 1 !== fields.length) {
      this.decodeUpTo(fields[fields.length - 1], false);
    }
    const constructorParams = Object.fromEntries(fields.map((key) => [key, this.cache.get(key)]));
    return this.materializedConstructor.fromCodec(constructorParams as CodecRecord<T>);
  }

  /**
   * Decode all of the fields up to the given one and return the value for that field.
   *
   * NOTE: this method should not be called if the value is already in the cache!
   */
  private decodeUpTo(field: keyof T, shouldWarn = true): T[keyof T] {
    let lastVal = undefined;
    const descriptorKeys = Object.keys(this.descriptors);
    const needIdx = descriptorKeys.findIndex((k) => k === field);
    check(
      this.lastDecodedIdx < needIdx,
      `Unjustified request to decode data: lastDecodedIdx: ${this.lastDecodedIdx}, need: ${needIdx} (${String(field)})`,
    );

    for (let i = this.lastDecodedIdx + 1; i <= needIdx; i += 1) {
      const key = descriptorKeys[i] as keyof DescriptorRecord<T>;
      const descriptor = this.descriptors[key];
      const val = descriptor.decode(this.d);
      this.cache.set(key, val);
      lastVal = val;
    }
    this.lastDecodedIdx = needIdx;
    if (shouldWarn && this.lastDecodedIdx + 1 === descriptorKeys.length) {
      logger.warn(
        `Decoded an entire object of class ${this.materializedConstructor.name}
         by accessing ${String(field)}. You should rather materialize.`,
      );
    }

    if (lastVal === undefined) {
      throw new Error(`Unable to decode field ${String(field)}: ${this.lastDecodedIdx} vs ${needIdx}`);
    }

    return lastVal;
  }

  /**
   * Get the value of the field from cache or decode it.
   */
  protected getOrDecode(field: keyof T): T[keyof T] {
    const cached = this.cache.get(field);
    return cached !== undefined ? cached : this.decodeUpTo(field);
  }

  /**
   * Get the view of the field from cache or decode it.
   */
  protected getOrDecodeView(field: keyof DescriptorRecord<T>): View<T[keyof T]> {
    const cached = this.cache.get(field);
    if (cached !== undefined) {
      logger.warn(
        `Requesting a view of an already decoded field ${String(field)} of
         class ${this.materializedConstructor.name}. Just get the decoded value instead.
        `,
      );
    }

    const viewCached = this.viewCache.get(field);
    if (viewCached !== undefined) {
      return viewCached;
    }
    // decode up to the previous field and then get the view.
    const descriptorKeys = Object.keys(this.descriptors);
    const needIdx = descriptorKeys.findIndex((k) => k === field);
    if (needIdx > 0) {
      this.decodeUpTo(descriptorKeys[needIdx - 1] as keyof T);
    }
    // return the view
    const val = this.descriptors[field];
    // we need to clone the decoder here, to make sure further calls
    // to the original view do not disrupt the nested one.
    if (!(VIEW_FIELD in val)) {
      throw new Error(`Attempting to decode a 'View' of a field ${String(field)} which doesn't have one.`);
    }

    const view = new val.View(this.d.clone());
    const typedView = view as unknown as View<T[keyof T]>;
    this.viewCache.set(field, typedView);
    return typedView;
  }
}

/** Typesafe iteration of every descriptor in the record object. */
function forEachDescriptor<T>(
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

/** Convenience method to create descriptors and avoid the superfluous typing. */
function descriptor<T>(
  name: string,
  sizeHintBytes: number,
  encode: (e: Encoder, elem: T) => void,
  decode: (d: Decoder) => T,
): Descriptor<T> {
  return new Descriptor(name, sizeHintBytes, encode, decode);
}
