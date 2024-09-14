import type { BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { check } from "@typeberry/utils";
import type { Decode, Decoder } from "./decoder";
import type { Encode, Encoder } from "./encoder";

const TYPICAL_SEQUENCE_LENGTH = 64;

export type Codec<T> = Encode<T> & Decode<T>;

export type Descriptor<T> = {
  name: string;
  sizeHintBytes: number;
} & Codec<T>;

export type ClassDescriptorOf<T> = {
  [K in keyof T]: Descriptor<T[K]>;
};

export type FieldsAsMethods<T> = {
  [K in keyof T]: () => T[K];
};

export type View<T> = {
  View: new (d: Decoder) => AbstractView<T> & FieldsAsMethods<T>;
};

export const VAR_U32 = descriptor<number>(
  "var_u32",
  4,
  (e, v) => e.varU32(v),
  (d) => d.varU32(),
);

export const VAR_U64 = descriptor<bigint>(
  "var_u64",
  8,
  (e, v) => e.varU64(v),
  (d) => d.varU64(),
);

export const U32 = descriptor<number>(
  "u32",
  4,
  (e, v) => e.i32(v),
  (d) => d.u32(),
);
export const U24 = descriptor<number>(
  "u24",
  3,
  (e, v) => e.i24(v),
  (d) => d.u24(),
);
export const U16 = descriptor<number>(
  "u16",
  2,
  (e, v) => e.i16(v),
  (d) => d.u16(),
);
export const U8 = descriptor<number>(
  "u8",
  1,
  (e, v) => e.i8(v),
  (d) => d.u8(),
);

export const I32 = descriptor<number>(
  "i32",
  4,
  (e, v) => e.i32(v),
  (d) => d.i32(),
);
export const I24 = descriptor<number>(
  "i24",
  3,
  (e, v) => e.i24(v),
  (d) => d.i24(),
);
export const I16 = descriptor<number>(
  "i16",
  2,
  (e, v) => e.i16(v),
  (d) => d.i16(),
);
export const I8 = descriptor<number>(
  "i8",
  1,
  (e, v) => e.i8(v),
  (d) => d.i8(),
);

export const BLOB = descriptor<BytesBlob>(
  "BytesBlob",
  TYPICAL_SEQUENCE_LENGTH,
  (e, v) => e.bytesBlob(v),
  (d) => d.bytesBlob(),
);

export const BITVEC_VAR_LEN = descriptor<BitVec>(
  "BitVec[?]",
  TYPICAL_SEQUENCE_LENGTH >>> 3,
  (e, v) => e.bitVecVarLen(v),
  (d) => d.bitVecVarLen(),
);

export const BITVEC_FIX_LEN = (len: number) =>
  descriptor<BitVec>(
    `BitVec[${len}]`,
    len >>> 3,
    (e, v) => e.bitVecFixLen(v),
    (d) => d.bitVecFixLen(len),
  );

export const OPTIONAL = <T>(type: Descriptor<T>) =>
  descriptor<T | null>(
    `Optional<${type.name}>`,
    1 + type.sizeHintBytes,
    (e, v) => e.optional(type, v),
    (d) => d.optional(type),
  );

export const SEQUENCE_VAR_LEN = <T>(type: Descriptor<T>) =>
  descriptor<T[]>(
    `Sequence<${type.name}>[?]`,
    TYPICAL_SEQUENCE_LENGTH * type.sizeHintBytes,
    (e, v) => e.sequenceVarLen(type, v),
    (d) => d.sequenceVarLen(type),
  );

export const SEQUENCE_FIX_LEN = <T>(type: Descriptor<T>, len: number) =>
  descriptor<T[]>(
    `Sequence<${type.name}>[${len}]`,
    len * type.sizeHintBytes,
    (e, v) => e.sequenceFixLen(type, v),
    (d) => d.sequenceFixLen(type, len),
  );

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

function forEachDescriptor<T>(
  descriptors: ClassDescriptorOf<T>,
  f: <K extends keyof T>(key: K, val: Descriptor<T[K]>) => void,
) {
  for (const key in descriptors) {
    if (key in descriptors) {
      f(key, descriptors[key]);
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: [ToDr] No idea how to define the constructor without any.
type Constructor<T> = new (...args: any[]) => T;

export const CLASS = <T>(
  name: string,
  Class: Constructor<T>,
  descriptors: ClassDescriptorOf<T>,
): Descriptor<T> & View<T> => {
  // Create a
  class View extends AbstractView<T> {
    constructor(d: Decoder) {
      super(d, Class, descriptors);
    }
  }
  // We need to dynamically extend the prototype to add these extra lazy getters.
  forEachDescriptor(descriptors, (key) => {
    if (typeof key === "string") {
      Object.defineProperty(View.prototype, key, {
        value: function (this: View) {
          return this.getOrDecode(key);
        },
      });
    }
  });

  // calculate a size hint
  let sizeHintBytes = 0;
  forEachDescriptor(descriptors, (_k, val) => {
    sizeHintBytes += val.sizeHintBytes;
  });

  // TODO [ToDr] How to ensure that the descriptor keys are in the same order
  // as the constructor parameters?
  const desc = descriptor<T>(
    name,
    sizeHintBytes,
    (e, t) => {
      forEachDescriptor(descriptors, (key, descriptor) => {
        const value = t[key];
        descriptor.encode(e, value);
      });
    },
    (d) => {
      const constructorParams: ConstructorParameters<typeof Class> = [];
      forEachDescriptor(descriptors, (_key, descriptor) => {
        const value = descriptor.decode(d);
        constructorParams.push(value);
      });
      return new Class(...constructorParams);
    },
  );

  return {
    View: View as new (d: Decoder) => AbstractView<T> & FieldsAsMethods<T>,
    ...desc,
  };
};

// TODO [ToDr] Add materialize method
abstract class AbstractView<T> {
  private lastDecodedIdx = -1;
  private readonly cache = new Map<string, unknown>();

  constructor(
    private readonly d: Decoder,
    protected readonly materializedConstructor: Constructor<T>,
    protected readonly descriptors: ClassDescriptorOf<T>,
  ) {}

  public materialize(): T {
    const fields = Object.keys(this.descriptors);
    // make sure to fully populate the cache.
    if (this.lastDecodedIdx + 1 !== fields.length) {
      this.decodeUpTo(fields[fields.length - 1]);
    }
    const constructorParams = fields.map((key) => this.cache.get(key));
    return new this.materializedConstructor(...constructorParams);
  }

  private decodeUpTo(field: string): unknown | undefined {
    let lastVal = undefined;
    const descriptorKeys = Object.keys(this.descriptors);
    const needIdx = descriptorKeys.findIndex((k) => k === field);
    check(
      this.lastDecodedIdx < needIdx,
      `Unjustified request to decode data: lastDecodedIdx: ${this.lastDecodedIdx}, need: ${needIdx}`,
    );

    for (let i = this.lastDecodedIdx + 1; i <= needIdx; i += 1) {
      const f = this.descriptors[descriptorKeys[i] as keyof ClassDescriptorOf<T>];
      const val = f.decode(this.d);
      this.cache.set(descriptorKeys[i], val);
      lastVal = val;
    }
    this.lastDecodedIdx = needIdx;
    if (this.lastDecodedIdx + 1 === descriptorKeys.length) {
      // TODO [ToDr] Should we finish here?
      // What if we are part of a bigger sequence? Or just a field in some other class?
      // this.d.finish();
    }
    return lastVal;
  }

  protected getOrDecode(field: string): unknown {
    const cached = this.cache.get(field);
    return cached !== undefined ? cached : this.decodeUpTo(field);
  }
}

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
