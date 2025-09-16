import type { BitVec } from "@typeberry/bytes";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tryAsU32, type U32 } from "@typeberry/numbers";
import { check } from "@typeberry/utils";

/** Hint for how big the encoded object will be. */
export type SizeHint = {
  /** Number of bytes in the encoding. */
  bytes: number;
  /** Is `bytes` the exact number of bytes that will be used or just a hint? */
  isExact: boolean;
};

export function tryAsExactBytes(a: SizeHint): number {
  check(a.isExact, "The value is not exact size estimation!");
  return a.bytes;
}

export function addSizeHints(a: SizeHint, b: SizeHint): SizeHint {
  return {
    bytes: a.bytes + b.bytes,
    isExact: a.isExact && b.isExact,
  };
}

/** An encoder for some specific type `T`. */
export type Encode<T> = {
  /** Encode given element of type `T`. */
  encode: (encoder: Encoder, elem: T) => void;
  /**
   * A hint about size of that type.
   *
   * Can be used as an optimization for how many bytes should be allocated for that type.
   */
  sizeHint: SizeHint;
};

/**
 * I had to extend ArrayBuffer type to use resizable ArrayBuffer.
 * We will be able to remove it when this is merged: https://github.com/microsoft/TypeScript/pull/58573
 * And then a new version of TypeScript is released.
 */
declare global {
  interface ArrayBufferConstructor {
    new (length: number, options?: { maxByteLength: number }): ArrayBuffer;
  }

  interface ArrayBuffer {
    resize(length: number): void;
  }
}

/**
 * New encoder options.
 *
 * Either provide a destination (needs to be able to fit all the data!)
 * or hint the expected length of the encoding to avoid re-allocations.
 */
export type Options =
  | {
      expectedLength: number;
    }
  | {
      destination: Uint8Array;
    };

const DEFAULT_START_LENGTH = 512; // 512B
const MAX_LENGTH = 10 * 1024 * 1024; // 10MB

/**
 * JAM encoder.
 */
export class Encoder {
  /**
   * Create a new encoder either to fill up given `destination`
   * or with a minimal expected size.
   */
  static create(options?: Options) {
    if (options !== undefined && "destination" in options) {
      return new Encoder(options.destination);
    }

    const startLength = options?.expectedLength ?? DEFAULT_START_LENGTH;
    const buffer = new ArrayBuffer(Math.min(MAX_LENGTH, startLength), { maxByteLength: MAX_LENGTH });
    const destination = new Uint8Array(buffer);
    return new Encoder(destination, buffer);
  }

  /**
   * Encode just a single object.
   *
   * NOTE that if you need to encode a tuple glueing together outputs
   * of that function is going to be sub-optimal!
   *
   * This is only for one-shot encodings.
   */
  static encodeObject<T>(encode: Encode<T>, object: T, context?: unknown): BytesBlob {
    const encoder = Encoder.create({
      expectedLength: encode.sizeHint.bytes || DEFAULT_START_LENGTH,
    });
    encoder.attachContext(context);
    encoder.object(encode, object);
    return encoder.viewResult();
  }

  private offset = 0;
  private context?: unknown;

  private readonly dataView: DataView;

  private constructor(
    private readonly destination: Uint8Array,
    private readonly buffer?: ArrayBuffer,
  ) {
    if (buffer !== undefined) {
      this.dataView = new DataView(buffer);
    } else {
      this.dataView = new DataView(destination.buffer, destination.byteOffset, destination.byteLength);
    }
  }

  /**
   * Attach context to the encoder.
   *
   * The context object can be used to pass some "global" parameters
   * down to custom encoders.
   */
  attachContext(context?: unknown) {
    this.context = context;
  }

  /**
   * Get the encoding context object.
   */
  getContext(): unknown {
    return this.context;
  }

  /**
   * View the current encoding result.
   *
   * Note that the resulting array here, might be shorter than the
   * underlying `destination`.
   */
  viewResult() {
    return BytesBlob.blobFrom(this.destination.subarray(0, this.offset));
  }

  /**
   * Encode a 32-bit integer.
   *
   * The encoding will always occupy 4 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i32(num: number) {
    this.prepareIntegerN(num, 4);
    this.dataView.setInt32(this.offset, num, true);
    this.offset += 4;
  }

  /**
   * Encode a 64-bit integer.
   *
   * The encoding will always occupy 8 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i64(num: bigint) {
    const maxNum = 2n ** 64n;
    // note that despite the actual range of values being within:
    // `[ - maxNum / 2, maxNum / 2)`
    // we still allow positive numbers from `[maxNum / 2, maxNum)`.
    // So it does not matter if the argument is a negative value,
    // OR if someone just gave us two-complement already.
    check(num < maxNum, "Only for numbers up to 2**64 - 1");
    check(-num <= maxNum / 2n, "Only for numbers down to -2**63");
    this.ensureBigEnough(8);

    this.dataView.setBigInt64(this.offset, num, true);
    this.offset += 8;
  }

  /**
   * Encode a 24-bit integer.
   *
   * The encoding will always occupy 3 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i24(num: number) {
    this.prepareIntegerN(num, 3);
    this.dataView.setInt8(this.offset, num & 0xff);
    this.dataView.setInt16(this.offset + 1, num >> 8, true);
    this.offset += 3;
  }

  /**
   * Encode a 16-bit integer.
   *
   * The encoding will always occupy 2 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i16(num: number) {
    this.prepareIntegerN(num, 2);
    this.dataView.setInt16(this.offset, num, true);
    this.offset += 2;
  }

  /**
   * Encode a 8-bit integer.
   *
   * The encoding will always occupy 1 byte in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i8(num: number) {
    this.prepareIntegerN(num, 1);
    this.dataView.setInt8(this.offset, num);
    this.offset += 1;
  }

  /**
   * Encode a single boolean discriminator using variable encoding.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/375300375300
   */
  bool(bool: boolean) {
    this.varU32(tryAsU32(bool ? 1 : 0));
  }

  /**
   * Prepare for encoding of a fixed-bytes number.
   *
   *
   * The encoding will always occupy N bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/36fc0136fc01
   */
  private prepareIntegerN(num: number, bytesToEncode: 1 | 2 | 3 | 4) {
    const BITS = 8;
    const maxNum = 2 ** (BITS * bytesToEncode);
    // note that despite the actual range of values being within:
    // `[ - maxNum / 2, maxNum / 2)`
    // we still allow positive numbers from `[maxNum / 2, maxNum)`.
    // So it does not matter if the argument is a negative value,
    // OR if someone just gave us two-complement already.
    check(num < maxNum, `Only for numbers up to 2**${BITS * bytesToEncode} - 1`);
    check(-num <= maxNum / 2, `Only for numbers down to -2**${BITS * bytesToEncode - 1}`);

    this.ensureBigEnough(bytesToEncode);
  }

  /**
   * Encode a 32-bit natural number (compact).
   *
   * The encoding can take variable amount of bytes depending on the actual value.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/365202365202
   */
  varU32(num: U32) {
    check(num >= 0, "Only for natural numbers.");
    check(num < 2 ** 32, "Only for numbers up to 2**32");
    this.varU64(BigInt(num));
  }

  /**
   * Encode a 64-bit natural number (compact).
   *
   * The encoding can take variable amount of bytes depending on the actual value.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/365202365202
   */
  varU64(value: bigint) {
    const num = BigInt(value); // this should be a no-op, but fixes incorrect usage in JS

    if (num === 0n) {
      this.ensureBigEnough(1);
      this.destination[this.offset] = 0;
      this.offset += 1;
      return;
    }

    // handle the biggest case
    let maxEncoded = 2n ** (7n * 8n);
    if (num >= maxEncoded) {
      this.ensureBigEnough(9);
      this.destination[this.offset] = 0xff;
      this.dataView.setBigUint64(this.offset + 1, num, true);
      this.offset += 9;
      return;
    }

    // let's look for the correct range
    let minEncoded = maxEncoded >> 7n;
    for (let l = 7; l >= 0; l -= 1) {
      if (num >= minEncoded) {
        this.ensureBigEnough(l + 1);

        // encode the first byte
        const maxVal = 2n ** BigInt(8 * l);
        const byte = BigInt(2 ** 8 - 2 ** (8 - l)) + num / maxVal;
        this.destination[this.offset] = Number(byte) & 0xff;
        this.offset += 1;
        // now encode the rest of bytes of len `l`
        let rest = num % maxVal;
        for (let i = this.offset; i < this.offset + l; i += 1) {
          this.destination[i] = Number(rest & 0xffn);
          rest >>= 8n;
        }
        this.offset += l;
        return;
      }
      // move one power down
      maxEncoded = minEncoded;
      minEncoded >>= 7n;
    }

    throw new Error(`Unhandled number encoding: ${num}`);
  }

  /**
   * Encode a variable-length sequence of bytes given as [`BytesBlob`].
   *
   * That's just a convenience wrapper for [`blob`] function.
   */
  bytesBlob(blob: BytesBlob) {
    this.blob(blob.raw);
  }

  /**
   * Encode a variable-length sequence of bytes.
   *
   * The data is placed in the destination, but with an
   * extra length-discriminator (see [`u32`]) encoded in a compact form.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/372600372600
   */
  blob(blob: Uint8Array) {
    // first encode the length
    this.varU32(tryAsU32(blob.length));

    // now encode the bytes
    this.ensureBigEnough(blob.length);
    this.destination.set(blob, this.offset);
    this.offset += blob.length;
  }

  /**
   * Encode a fixed-length sequence of bytes.
   *
   * The data is simply copied to the destination
   * without any discriminator (i.e. no length prefix).
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/371100371100
   *
   */
  bytes<N extends number>(bytes: Bytes<N>) {
    this.ensureBigEnough(bytes.length);

    this.destination.set(bytes.raw, this.offset);
    this.offset += bytes.length;
  }

  /**
   * Encode a bit vector with known length.
   *
   * The bits are packed into bytes and just placed as-is in the destination.
   * https://graypaper.fluffylabs.dev/#/579bd12/378000378000
   */
  bitVecFixLen(bitvec: BitVec) {
    const bytes = bitvec.raw;
    this.bytes(Bytes.fromBlob(bytes, bytes.length));
  }

  /**
   * Encode a bit vector with variable length.
   *
   * A bit-length discriminator (varU32) is placed before the packed bit content.
   * https://graypaper.fluffylabs.dev/#/579bd12/378200378200
   */
  bitVecVarLen(bitvec: BitVec) {
    const len = bitvec.bitLength;
    this.varU32(tryAsU32(len));
    this.bitVecFixLen(bitvec);
  }

  /**
   * Encode a composite object.
   */
  object<T>(encode: Encode<T>, element: T) {
    this.applySizeHint(encode);
    encode.encode(this, element);
  }

  /**
   * Encode a potentially empty value.
   *
   * A 0 or 1 is placed before the element to indicate it's presence.
   * https://graypaper.fluffylabs.dev/#/579bd12/375f00375f00
   */
  optional<T>(encode: Encode<T>, element?: T | null) {
    const isSet = element !== null && element !== undefined;
    this.bool(isSet);
    if (isSet) {
      this.applySizeHint(encode);
      encode.encode(this, element);
    }
  }

  /**
   * Encode a fixed-length sequence of elements of some type.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/371100371100
   */
  sequenceFixLen<T>(encode: Encode<T>, elements: readonly T[]) {
    this.applySizeHint(encode, elements.length);
    for (const e of elements) {
      encode.encode(this, e);
    }
  }

  /**
   * Encode a variable-length sequence of elements of some type.
   *
   * A length discriminator is placed before the concatentation of encodings of all the elements.
   *
   * https://graypaper.fluffylabs.dev/#/579bd12/374400374400
   */
  sequenceVarLen<T>(encode: Encode<T>, elements: readonly T[]) {
    check(elements.length <= 2 ** 32, "Wow, that's a nice long sequence you've got here.");
    this.varU32(tryAsU32(elements.length));
    this.sequenceFixLen(encode, elements);
  }

  private applySizeHint<T>(encode: Encode<T>, multiply = 1) {
    const sizeHint = encode.sizeHint.bytes;
    if (sizeHint > 0 && multiply > 0) {
      this.ensureBigEnough(sizeHint * multiply, { silent: true });
    }
  }

  /**
   * Expand the destination to fit given length.
   *
   * The `silent` flag can be set when we are just giving a size hint about
   * a composite type being encoded.
   * In such case we are not sure if we are going to use all of the bytes from the hint,
   * so going over `MAX_LENGTH` or destination is not an error here.
   * When subsequent fields of a composite object will be encode they call this function
   * anyway, so if we really should throw we will.
   */
  private ensureBigEnough(length: number, options: { silent: boolean } = { silent: false }) {
    check(length >= 0, "Negative length given");

    const newLength = this.offset + length;
    if (newLength > MAX_LENGTH) {
      if (options.silent) {
        return;
      }
      throw new Error(`The encoded size would reach the maximum of ${MAX_LENGTH}.`);
    }

    if (newLength > this.destination.length) {
      // we can try to resize the underlying buffer
      if (this.buffer !== undefined) {
        // make sure we at least double the size of the buffer every time.
        const minExtend = Math.max(newLength, this.buffer.byteLength << 1);
        // but we must never exceed the max length.
        this.buffer.resize(Math.min(MAX_LENGTH, minExtend));
      }
      // and then check again
      if (newLength > this.destination.length) {
        if (options.silent) {
          return;
        }
        throw new Error(
          `Not enough space in the destination array. Needs ${newLength}, has ${this.destination.length}.`,
        );
      }
    }
  }
}
