import { BytesBlob } from "@typeberry/bytes";
import { check, ensure } from "@typeberry/utils";
import type { Decoder } from "./decoder";
import type { ClassConstructor, CodecRecord, Descriptor, DescriptorRecord } from "./descriptors";
import { Skipper } from "./skip";

/** View type for given complex object `T`. */
export type ViewOf<T, D extends DescriptorRecord<T>> = ObjectView<T> & {
  [K in keyof D]: D[K] extends Descriptor<infer T, infer V> ? ViewField<T, V> : never;
};

/** A caching wrapper for either object or sequence item. */
export class ViewField<T, V> implements ViewField<T, V> {
  private cachedValue: T | undefined;
  private cachedView: V | undefined;
  private cachedBlob: BytesBlob | undefined;

  constructor(
    private readonly getView: () => V,
    private readonly getValue: () => T,
    private readonly getEncoded: () => BytesBlob,
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

  /** Return an encoded value of that object. */
  encoded(): BytesBlob {
    if (this.cachedBlob === undefined) {
      this.cachedBlob = this.getEncoded();
    }
    return this.cachedBlob;
  }
}

/**
 * A base class for all the lazy views.
 */
export abstract class ObjectView<T> {
  /** Keys of all descriptors. */
  private readonly descriptorsKeys: (keyof T)[];
  /** Already decoded items. */
  private readonly cache = new Map<keyof T, ViewField<T[keyof T], unknown>>();
  /** Initial decoder state. */
  private readonly initialDecoderOffset;
  /** Last decoded index that we have in the cache already. */
  private lastDecodedFieldIdx = -1;

  constructor(
    private readonly decoder: Decoder,
    protected readonly materializedConstructor: ClassConstructor<T>,
    protected readonly descriptors: DescriptorRecord<T>,
  ) {
    this.descriptorsKeys = Object.keys(descriptors) as (keyof T)[];
    this.initialDecoderOffset = decoder.bytesRead();
  }

  /**
   * Create a concrete instance of `T` by decoding all of the remaining
   * fields that are not yet there in the cache.
   */
  materialize(): T {
    const fields = this.descriptorsKeys;
    const constructorParams = Object.fromEntries(fields.map((key) => [key, this.get(key).materialize()]));
    return this.materializedConstructor.fromCodec(constructorParams as CodecRecord<T>);
  }

  /** Return an encoded value of that object. */
  encoded(): BytesBlob {
    const fields = this.descriptorsKeys;
    // edge case?
    if (fields.length === 0) {
      return BytesBlob.blobFromNumbers([]);
    }

    if (this.lastDecodedFieldIdx < fields.length - 1) {
      const lastField = fields[fields.length - 1];
      this.decodeUpTo(lastField);
    }
    // now our `this.d` points to the end of the object, so we can use
    // it to determine where is the end of the encoded data.
    return BytesBlob.blobFrom(this.decoder.source.subarray(this.initialDecoderOffset, this.decoder.bytesRead()));
  }

  /**
   * Get the value of the field from cache or decode it.
   */
  protected get<K extends keyof T>(field: K): ViewField<T[K], unknown> {
    const cached: ViewField<T[keyof T], unknown> | undefined = this.cache.get(field);
    if (cached !== undefined) {
      return cached as ViewField<T[K], unknown>;
    }

    return this.decodeUpTo(field);
  }

  private decodeUpTo<K extends keyof T>(field: K): ViewField<T[K], unknown> {
    const index = this.descriptorsKeys.indexOf(field);
    const lastField = this.descriptorsKeys[this.lastDecodedFieldIdx];
    check(
      this.lastDecodedFieldIdx < index,
      `Unjustified call to 'decodeUpTo' -
       the index ($Blobindex}, ${String(field)})
       is already decoded (${this.lastDecodedFieldIdx}, ${String(lastField)}).
      `,
    );

    let lastItem = this.cache.get(lastField);
    const skipper = new Skipper(this.decoder);

    // now skip all of the fields and further populate the cache.
    for (let i = this.lastDecodedFieldIdx + 1; i <= index; i++) {
      // create new cached prop
      const fieldDecoder = skipper.decoder.clone();
      const field = this.descriptorsKeys[i];
      const type = this.descriptors[field as keyof DescriptorRecord<T>];
      lastItem = new ViewField(
        () => type.View.decode(fieldDecoder.clone()),
        () => type.decode(fieldDecoder.clone()),
        () => type.skipEncoded(fieldDecoder.clone()),
      );
      // skip the field
      type.skip(skipper);
      // cache data
      this.cache.set(field, lastItem);
      this.lastDecodedFieldIdx = i;
    }

    const last: ViewField<T[K], unknown> = ensure(
      lastItem,
      lastItem !== undefined,
      "Last item must be set, since the loop turns at least once.",
    );
    return last;
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
  /** Length of the sequence (either already decoded or given if fixed). */
  public readonly length: number;
  /** Already decoded items. */
  private readonly cache = new Map<number, ViewField<T, V>>();
  /** Initial decoder state. */
  private readonly initialDecoderOffset;
  /** Last decoded index that we have in the cache already. */
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

  /** Create an array of all views mapped to some particular value. */
  map<R>(cb: (v: ViewField<T, V>) => R): R[] {
    const res = new Array(this.length);
    let i = 0;
    for (const v of this) {
      res[i] = cb(v);
      i++;
    }
    return res;
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

    const v = this.cache.get(index);
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
    check(
      this.lastDecodedIdx < index,
      `Unjustified call to 'decodeUpTo' - the index (${index}) is already decoded (${this.lastDecodedIdx}).`,
    );
    let lastItem = this.cache.get(this.lastDecodedIdx);
    const skipper = new Skipper(this.decoder);

    // now skip all of the fields and further populate the cache.
    for (let i = this.lastDecodedIdx + 1; i <= index; i++) {
      // create new cached prop
      const fieldDecoder = skipper.decoder.clone();
      const type = this.descriptor;
      lastItem = new ViewField(
        () => type.View.decode(fieldDecoder.clone()),
        () => type.decode(fieldDecoder.clone()),
        () => type.skipEncoded(fieldDecoder.clone()),
      );
      // skip the field
      type.skip(skipper);
      // cache data
      this.cache.set(i, lastItem);
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
