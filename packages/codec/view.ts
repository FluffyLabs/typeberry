import { BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { check, ensure } from "@typeberry/utils";
import type { Decoder } from "./decoder";
import type { ClassConstructor, CodecRecord, Descriptor, DescriptorRecord } from "./descriptors";
import { Skipper } from "./skip";

/** View type for given complex object `T`. */
export type ViewOf<T, D extends DescriptorRecord<T>> = ObjectView<T> & {
  [K in keyof D]: D[K] extends Descriptor<infer T, infer V> ? ViewField<T, V> : never;
};

/** Object or sequence item that can be either materialized or viewed. */
export type ViewField<T, V> = {
  /** Fully decode the underlying data. */
  materialize(): T;
  /** Decode just the view of the underlying data. */
  view(): V;
};

/** A caching wrapper for either object or sequence item. */
class ViewFieldInternal<T, V> implements ViewField<T, V> {
  private cachedValue: T | undefined;
  private cachedView: V | undefined;

  constructor(
    private readonly getView: () => V,
    private readonly getValue: () => T,
  ) {}

  /** Fully decode the underlying data. */
  materialize(): T {
    if (this.cachedValue === undefined) {
      this.cachedValue = this.getValue();
    }
    return this.cachedValue;
  }

  /** Decode just the view of the underlying data. */
  view(): V {
    if (this.cachedView === undefined) {
      this.cachedView = this.getView();
    }
    return this.cachedView;
  }
}

const logger = Logger.new(__filename, "codec/descriptors");

/**
 * A base class for all the lazy views.
 */
export abstract class ObjectView<T> {
  private lastCachedIdx = -1;
  // TODO [ToDr] Do we really need 3 separate maps?
  // TODO [ToDr] Return ViewField from here already!

  /**
   * Cache of state of the decoder just before particular field.
   * NOTE: make sure to clone the decoder every time you get it from cache!
   */
  private readonly decoderStateCache = new Map<keyof T, Decoder>();
  /** Cache for field values. */
  private readonly cache = new Map<keyof T, T[keyof T]>();
  /** Cache for views of fields. */
  private readonly viewCache = new Map<keyof T, unknown>();

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
  protected getOrDecodeView(field: keyof DescriptorRecord<T>): unknown {
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
    if (descriptor.View === null) {
      throw new Error(`Attempting to decode a 'View' of a field ${String(field)} which doesn't have one.`);
    }

    // we need to clone the decoder here, to make sure further calls
    // to the original view do not disrupt the nested one.
    const view = decoder.object<unknown>(descriptor.View);
    this.viewCache.set(field, view);
    return view;
  }
}

/**
 * A lazy-evaluated decoder of a sequence.
 *
 * Instead of decoding/allocating the whole collection at once,
 * you can wrap the decoder into `SequenceView` to do it lazily.
 *
 * Collection items can be decoded fully (materialized) or can
 * just be requested as views.
 */
export class SequenceView<T, V = T> {
  private readonly itemsCache = new Map<number, ViewField<T, V>>();
  private readonly length: number;
  private readonly initialDecoderOffset;
  private lastDecodedIdx = -1;

  constructor(
    private readonly decoder: Decoder,
    private readonly descriptor: Descriptor<T, V>,
    fixedLength?: number,
  ) {
    this.initialDecoderOffset = this.decoder.bytesRead();
    this.length = fixedLength ?? decoder.varU32();
  }

  /** Iterate over field elements of the view. */
  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      const val = this.get(i);
      const v: ViewField<T, V> = ensure(
        val,
        val !== undefined,
        "We are within 0..this.length so all items are defined.",
      );
      yield v;
    }
  }

  /**
   * Retrieve item at given index.
   *
   * The item can be either materialized or it's view can be requested.
   */
  get(index: number): ViewField<T, V> | undefined {
    if (index >= this.length) {
      return undefined;
    }

    const v = this.itemsCache.get(index);
    if (v !== undefined) {
      return v;
    }

    // populate the cache
    return this.decodeUpTo(index);
  }

  /** Return an encoded value of that object. */
  encoded(): BytesBlob {
    // edge case?
    if (this.length === 0) {
      return BytesBlob.blobFromNumbers([]);
    }

    if (this.lastDecodedIdx < this.length - 1) {
      this.decodeUpTo(this.length - 1);
    }
    // now our `this.decoder` points to the end of the object, so we can use
    // it to determine where is the end of the encoded data.
    return BytesBlob.blobFrom(this.decoder.source.subarray(this.initialDecoderOffset, this.decoder.bytesRead()));
  }

  private decodeUpTo(index: number): ViewField<T, V> {
    check(this.lastDecodedIdx < index, "Unjustified call to `decodeUpTo` - the index is already decodec.");
    let lastItem = this.itemsCache.get(this.lastDecodedIdx);
    const skipper = new Skipper(this.decoder);

    // now skip all of the fields and further populate the cache.
    for (let i = this.lastDecodedIdx + 1; i <= index; i++) {
      // create new cached prop
      const fieldDecoder = skipper.decoder.clone();
      const type = this.descriptor;
      lastItem = new ViewFieldInternal(
        () => type.View.decode(fieldDecoder.clone()),
        () => type.decode(fieldDecoder.clone()),
      );
      // skip the field
      type.skip(skipper);
      // cache data
      this.itemsCache.set(i, lastItem);
      this.lastDecodedIdx = i;
    }

    const last: ViewField<T, V> = ensure(
      lastItem,
      lastItem !== undefined,
      "Last item must be set, since the loop turns at least once.",
    );
    return last;
  }
}
