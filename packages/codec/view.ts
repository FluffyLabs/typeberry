import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import { Decoder } from "./decoder";
import { forEachDescriptor, type ClassConstructor, type ClassDescriptor, type CodecRecord, type DescriptorRecord, type PropertyKeys } from "./descriptors";
import { Skipper } from "./skip";

/** An extra key for `View` or `*View` method. */
export const VIEW_FIELD = "View";

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
export type ViewConstructor<T, NestedViewKeys extends keyof T> = {
  new (d: Decoder): View<T, NestedViewKeys>;
  fromBytesBlob(bytes: BytesBlob | Uint8Array, context?: unknown): View<T, NestedViewKeys>;
};

/** Extract the view type given the constructor. */
type ViewOf<C> = C extends ViewConstructor<infer T, infer N> ? View<T, N> : never;

export type KeysWithView<T, D extends DescriptorRecord<T>> = {
  [K in PropertyKeys<T>]: D[K] extends ClassDescriptor<T[K], infer _> ? K : never;
}[PropertyKeys<T>];

const logger = Logger.new(__filename, "codec/descriptors");

function viewMethod(key: string) {
  return `${key}${VIEW_FIELD}`;
}

export function viewFor<T, D extends DescriptorRecord<T>>(Class: ClassConstructor<T>, descriptors: D) {
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

  return ClassView;
}

/**
 * A base class for all the lazy views.
 */
export abstract class AbstractView<T> {
  private lastCachedIdx = -1;
  /**
   * Cache of state of the decoder just before particular field.
   * NOTE: make sure to clone the decoder every time you get it from cache!
   */
  private readonly decoderStateCache = new Map<keyof T, Decoder>();
  /** Cache for field values. */
  private readonly cache = new Map<keyof T, T[keyof T]>();
  /** Cache for views of fields. */
  private readonly viewCache = new Map<keyof T, View<T[keyof T]>>();

  /** Keys of all descriptors. */
  private readonly descriptorsKeys;
  /** Initial offset of the decoder - used to calculate encoded data boundaries. */
  private readonly initialOffset;

  constructor(
    private readonly d: Decoder,
    protected readonly materializedConstructor: ClassConstructor<T>,
    protected readonly descriptors: DescriptorRecord<T>,
  ) {
    this.descriptorsKeys = Object.keys(descriptors);
    this.initialOffset = d.bytesRead();
  }

  /**
   * Create a concrete instance of `T` by decoding all of the remaining
   * fields that are not yet there in the cache.
   */
  public materialize(): T {
    const fields = this.descriptorsKeys;
    const constructorParams = Object.fromEntries(fields.map((key) => [key, this.getOrDecode(key as keyof T)]));
    return this.materializedConstructor.fromCodec(constructorParams as CodecRecord<T>);
  }

  /** Return an encoded value of that object. */
  public encoded(): BytesBlob {
    const fields = this.descriptorsKeys;
    // edge case?
    if (fields.length === 0) {
      return BytesBlob.blobFromNumbers([]);
    }

    const lastField = fields[fields.length - 1];
    this.populateDecoderStateCache(lastField as keyof T);
    // now our `this.d` points to the end of the object, so we can use
    // it to determine where is the end of the encoded data.
    return BytesBlob.blobFrom(this.d.source.subarray(this.initialOffset, this.d.bytesRead()));
  }

  /**
   * Get the value of the field from cache or decode it.
   */
  protected getOrDecode(field: keyof T): T[keyof T] {
    const cached = this.cache.get(field);
    return cached !== undefined ? cached : this.decodeField(field);
  }

  /**
   * Traverse the encoded data by skipping bytes up to the give `field`.
   *
   * This method populates the cache of decoder states (i.e. we will
   * know where exactly each previous field is in the data buffer).
   *
   * Returns the `descriptor` for given field and it's index.
   */
  private populateDecoderStateCache(field: keyof T) {
    const descriptor = this.descriptors[field as keyof DescriptorRecord<T>];
    let decoder = this.decoderStateCache.get(field);

    if (!decoder) {
      decoder = this.d;
      const descriptorKeys = this.descriptorsKeys;
      const needIdx = descriptorKeys.findIndex((k) => k === field);
      // make sure we have the decoder state at that field.
      const skip = new Skipper(this.d);
      for (let i = this.lastCachedIdx + 1; i <= needIdx; i += 1) {
        const key = descriptorKeys[i] as keyof DescriptorRecord<T>;
        const descriptor = this.descriptors[key];
        decoder = skip.decoder.clone();
        this.decoderStateCache.set(key, decoder);
        descriptor.skip(skip);
        this.lastCachedIdx = i;
      }
    }

    return { descriptor, decoder: decoder.clone() };
  }

  /**
   * Decode just given field.
   *
   * During the process we will skip all previous fields and populate the cache
   * of decoder states.
   *
   * NOTE: this method should not be called if the value is already in the cache!
   */
  private decodeField(field: keyof T): T[keyof T] {
    check(!this.cache.has(field), `Unjustified request to decode field ${String(field)}`);

    const { descriptor, decoder } = this.populateDecoderStateCache(field);
    const val = descriptor.decode(decoder);
    this.cache.set(field, val);
    return val;
  }

  /**
   * Get the view of the field from cache or decode it.
   */
  protected getOrDecodeView(field: keyof DescriptorRecord<T>): View<T[keyof T]> {
    // check if we have the materialized field
    const cached = this.cache.get(field);
    if (cached !== undefined) {
      logger.warn(
        `Requesting a view of an already decoded field ${String(field)} of
         class ${this.materializedConstructor.name}. Just get the decoded value instead.
        `,
      );
    }
    // and check if we already have the view in cache.
    const viewCached = this.viewCache.get(field);
    if (viewCached !== undefined) {
      return viewCached;
    }
    // decode up to the previous field
    const { descriptor, decoder } = this.populateDecoderStateCache(field);
    if (!(VIEW_FIELD in descriptor)) {
      throw new Error(`Attempting to decode a 'View' of a field ${String(field)} which doesn't have one.`);
    }

    // we need to clone the decoder here, to make sure further calls
    // to the original view do not disrupt the nested one.
    const view = new descriptor.View(decoder);
    const typedView = view as unknown as View<T[keyof T]>;
    this.viewCache.set(field, typedView);
    return typedView;
  }
}
