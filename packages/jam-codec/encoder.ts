import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { BitVec } from "@typeberry/bytes/bitvec";
import { check } from "@typeberry/utils";

// TODO [ToDr] bitvec
// TODO [ToDr] sequences
// TODO [ToDr] bignums - decide for builtin vs custom type

export type Encode<T> = {
  encode: (encoder: Encoder, elem: T) => void;
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
    if (options && "destination" in options) {
      return new Encoder(options.destination);
    }

    const startLength = options?.expectedLength ?? DEFAULT_START_LENGTH;
    const buffer = new ArrayBuffer(startLength, { maxByteLength: MAX_LENGTH });
    const destination = new Uint8Array(buffer);
    return new Encoder(destination, buffer);
  }

  private offset = 0;
  private readonly dataView: DataView;

  private constructor(
    private readonly destination: Uint8Array,
    private readonly buffer?: ArrayBuffer,
  ) {
    if (buffer) {
      this.dataView = new DataView(buffer);
    } else {
      this.dataView = new DataView(destination.buffer, destination.byteOffset, destination.byteLength);
    }
  }

  /**
   * View the current encoding result.
   *
   * Note that the resulting array here, might be shorter than the
   * underlying `destination`.
   */
  viewResult() {
    return new BytesBlob(this.destination.subarray(0, this.offset));
  }

  /**
   * Encoded a 32-bit integer.
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
   * Encoded a 24-bit integer.
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
   * Encoded a 16-bit integer.
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
   * Encoded a 8-bit integer.
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
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZGZlIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhjIHkxZGZmIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
   */
  bool(bool: boolean) {
    this.varU32(bool ? 1 : 0);
  }

  /**
   * Prepare for encoding of a fixed-bytes number.
   *
   *
   * The encoding will always occupy N bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGg2IHk0YyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5NGQgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iXV0=
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
   * TODO [ToDr] Change to bigint.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZGJlIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDYxIGhkIHkxZGJmIGZmMTcgZnM1IGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  varU32(num: number) {
    check(num >= 0, "Only for natural numbers.");
    check(num < 2 ** 32, "Only for numbers up to 2**32");

    if (num === 0) {
      this.ensureBigEnough(1);
      this.destination[this.offset] = num;
      this.offset += 1;
      return;
    }

    // find the size. Since we only encode u32 here,
    // we can safely start in the middle
    let maxEncoded = 2 ** (7 * 5);
    // note we use `/ 2**7` here not binary,
    // since `maxEncoded` is greater than 2**32
    let minEncoded = maxEncoded / 2 ** 7;
    for (let l = 4; l >= 0; l -= 1) {
      if (num >= minEncoded) {
        this.ensureBigEnough(l + 1);

        const maxVal = l === 0 ? minEncoded : minEncoded << 1;
        const byte = (2 ** 8 - 2 ** (8 - l) + Math.floor(num / maxVal)) & 0xff;
        this.destination[this.offset] = byte;
        this.offset += 1;
        if (l > 0) {
          // encode the bytes of len `l`
          const rest = num % maxVal;
          if (l === 4) {
            this.i32(rest);
          } else if (l === 3) {
            this.i24(rest);
          } else if (l === 2) {
            this.i16(rest);
          } else {
            this.i8(rest);
          }
        }
        return;
      }
      // move one power down
      maxEncoded = minEncoded;
      minEncoded >>>= 7;
    }

    throw new Error(`Unhandled number encoding: ${num}`);
  }

  /**
   * Encode a variable-length sequence of bytes given as [`BytesBlob`].
   *
   * That's just a convenience wrapper for [`blob`] function.
   */
  bytesBlob(blob: BytesBlob) {
    this.blob(blob.buffer);
  }

  /**
   * Encode a variable-length sequence of bytes.
   *
   * The data is placed in the destination, but with an
   * extra length-discriminator (see [`u32`]) encoded in a compact form.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZGYzIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhiIHkxZGY0IGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
   */
  blob(blob: Uint8Array) {
    // first encode the length
    this.varU32(blob.length);

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
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzAiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZDk2IGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhiIHkxZDk3IGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
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
   * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeGYgaDYgeTFlNjEgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4ZiBoNiB5MWU2MiBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  bitVecFixLen(bitvec: BitVec) {
    const bytes = bitvec.raw();
    this.bytes(new Bytes(bytes, bytes.length));
  }

  /**
   * Encode a bit vector with variable length.
   *
   * A bit-length discriminator (varU32) is placed before the packed bit content.
   * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeGYgaDYgeTFlNjEgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4ZiBoNiB5MWU2MiBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  bitVecVarLen(bitvec: BitVec) {
    const len = bitvec.bitLength;
    this.varU32(len);
    this.bitVecFixLen(bitvec);
  }

  /**
   * Encode a potentially empty value.
   *
   * A 0 or 1 is placed before the element to indicate it's presence.
   * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEyIGg2IHkxZTU2IGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeGYgaGMgeTFlNTcgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iXV0=
   */
  optional<T>(encode: Encode<T>, element?: T | null) {
    const isSet = element !== null && element !== undefined;
    this.bool(isSet);
    if (isSet) {
      encode.encode(this, element);
    }
  }

  /**
   * Encode a fixed-length sequence of elements of some type.
   *
   * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeGYgaGIgeTFlNDIgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4ZiBoYSB5MWU0MyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  sequenceFixLen<T>(encode: Encode<T>, elements: T[]) {
    for (const e of elements) {
      encode.encode(this, e);
    }
  }

  /**
   * Encode a variable-length sequence of elements of some type.
   *
   * A length discriminator is placed before the concatentation of encodings of all the elements.
   *
   * https://graypaper.fluffylabs.dev/#WyI3YWU1MWY5MzI1IiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeGYgaGIgeTFlNDIgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iLCI8ZGl2IGNsYXNzPVwidCBtMCB4ZiBoYSB5MWU0MyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  sequenceVarLen<T>(encode: Encode<T>, elements: T[]) {
    this.varU32(elements.length);
    this.sequenceFixLen(encode, elements);
  }

  private ensureBigEnough(length: number) {
    check(length >= 0, "Negative length given");

    const newLength = this.offset + length;
    if (newLength > MAX_LENGTH) {
      throw new Error(`The encoded size would reach the maximum of ${MAX_LENGTH}.`);
    }

    if (newLength > this.destination.length) {
      // we can try to resize the underlying buffer
      if (this.buffer) {
        // make sure we at least double the size of the buffer every time.
        const minExtend = Math.max(newLength, this.buffer.byteLength * 2);
        // but we must never exceed the max length.
        this.buffer.resize(Math.min(MAX_LENGTH, minExtend));
      }
      // and then check again
      if (newLength > this.destination.length) {
        throw new Error(
          `Not enough space in the destination array. Needs ${newLength}, has ${this.destination.length}.`,
        );
      }
    }
  }
}
