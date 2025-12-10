import { BytesBlob } from "@typeberry/bytes";
import { asOpaqueType, type Opaque, seeThrough, type TokenOf } from "@typeberry/utils";
import type { Decode, Decoder } from "./decoder.js";
import type { Encode, Encoder, SizeHint } from "./encoder.js";
import { type Skip, Skipper } from "./skip.js";

/** Infer the type that is described by given descriptor `T` */
export type DescribedBy<T> = T extends Descriptor<infer V, infer _> ? V : never;

/**
 * Converts a class `T` into an object with the same fields as the class.
 */
export type CodecRecord<T> = {
  [K in PropertyKeys<T>]: T[K];
};

/**
 * Same as `CodecRecord<T>`, but the fields are all optional.
 */
export type OptionalRecord<T> = {
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
export type SimpleDescriptorRecord<T> = {
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
  create: (o: CodecRecord<T>) => T;
};

/** A full codec type, i.e. the `Encode` and `Decode`. */
export type Codec<T> = Encode<T> & Decode<T>;

/** A codec descriptor with extra view. */
export interface CodecWithView<T, V> extends Codec<T> {
  /** encoded data view codec. */
  View: Codec<V>;
}

/**
 * Type descriptor definition.
 *
 * The type descriptor can encode & decode given type `T`, but
 * also have a `name` and a byte-size hint.
 *
 * Descriptors can be composed to form more complex typings.
 */
export class Descriptor<T, V = T> implements Codec<T>, Skip, CodecWithView<T, V> {
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
  public asOpaque<R>(): Descriptor<Opaque<T, TokenOf<R, T>>, V> {
    return this.convert(
      (i) => seeThrough(i),
      (o) => asOpaqueType<T, TokenOf<R, T>>(o),
    );
  }
}
