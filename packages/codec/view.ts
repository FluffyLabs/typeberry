import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Logger } from "@typeberry/logger";
import { check } from "@typeberry/utils";
import type { Decoder } from "./decoder";
import {
  type ClassConstructor,
  type CodecRecord,
  type Descriptor,
  type DescriptorRecord,
  descriptor,
  forEachDescriptor,
} from "./descriptors";
import type { SizeHint } from "./encoder";
import { type Skip, Skipper } from "./skip";

export type ViewType<T> = T extends Descriptor<infer V> ? V : never;

export type ViewField<T, V> = {
  materialize(): T;
  view(): V;
};

export type ViewOf<T, D extends DescriptorRecord<T>> = ObjectView<T> & {
  [K in keyof D]: D[K] extends Descriptor<infer T, infer V> ? ViewField<T, V> : never;
};

export function objectView<T, D extends DescriptorRecord<T>>(
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
          return {
            view: () => this.getOrDecodeView(key),
            materialize: () => this.getOrDecode(key),
          };
        },
      });
    }
  });

  return descriptor(
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

const logger = Logger.new(__filename, "codec/descriptors");

/**
 * A base class for all the lazy views.
 */
export abstract class ObjectView<T> {
  private lastCachedIdx = -1;
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
