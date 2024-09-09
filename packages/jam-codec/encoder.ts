import {Bytes, BytesBlob} from "@typeberry/bytes";
import {check} from "@typeberry/utils";

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

export type Options = {
  expectedLength: number
} | {
  destination: Uint8Array,
};

const DEFAULT_START_LENGTH = 512; // 512B
const MAX_LENGTH = 10 * 1024 * 1024; // 10MB

export class Encoder {
  static create(options?: Options) {
    if (options && 'destination' in options) {
      return new Encoder(options.destination);
    }

    const startLength = options?.expectedLength ?? DEFAULT_START_LENGTH;
    const buffer = new ArrayBuffer(startLength, { maxByteLength: MAX_LENGTH });
    const destination = new Uint8Array(buffer);
    return new Encoder(new Uint8Array(destination), buffer);
  }

  private offset: number = 0;

  private constructor(private readonly destination: Uint8Array, private readonly buffer?: ArrayBuffer) {}

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
    this.iN(num, 4);
  }

  /**
   * Encoded a 24-bit integer.
   *
   * The encoding will always occupy 3 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i24(num: number) {
    this.iN(num, 3);
  }

  /**
   * Encoded a 16-bit integer.
   *
   * The encoding will always occupy 2 bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i16(num: number) {
    this.iN(num, 2);
  }

  /**
   * Encoded a 8-bit integer.
   *
   * The encoding will always occupy 1 byte in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   */
  i8(num: number) {
    this.iN(num, 1);
  }

  /**
   * Encode a fixed-bytes number.
   *
   *
   * The encoding will always occupy N bytes in little-endian ordering.
   * Negative numbers are represented as a two-complement.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGg2IHk0YyBmZjcgZnMwIGZjMCBzYzAgbHMwIHdzMFwiPiIsIjxkaXYgY2xhc3M9XCJ0IG0wIHgxMCBoNiB5NGQgZmY3IGZzMCBmYzAgc2MwIGxzMCB3czBcIj4iXV0=
   */
  private iN(num: number, bytesToEncode: 1 | 2 | 3 | 4) {
    const BITS = 8;
    const maxNum = 2**(BITS * bytesToEncode);
    // note that despite the actual range of values being within:
    // `[ - maxNum / 2, maxNum / 2)`
    // we still allow positive numbers from `[maxNum / 2, maxNum)`.
    // So it does not matter if the argument is a negative value,
    // OR if someone just gave us two-complement already.
    check(num < maxNum, `Only for numbers up to 2**${BITS * bytesToEncode} - 1`);
    check(-num <= (maxNum / 2), `Only for numbers down to -2**${BITS * bytesToEncode - 1}`);

    this.ensureBigEnough(bytesToEncode);

    let encodeNum = num < 0 ? maxNum - num + 1 : num;
    for (let i = this.offset; i < this.offset + bytesToEncode; i+= 1) {
      this.destination[i] = encodeNum & 0xff;
      encodeNum >>>= BITS;
    }
    this.offset += bytesToEncode;
  }

  /**
   * Encode a 32-bit natural number (compact).
   *
   * The encoding can take various amount of bytes depending on the actual value.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZGJlIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDYxIGhkIHkxZGJmIGZmMTcgZnM1IGZjMCBzYzAgbHMwIHdzMFwiPiJdXQ==
   */
  u32(num: number)  {
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
    let minEncoded = maxEncoded / 2**7;
    for (let l = 4; l >= 0; l -= 1) {
      if (num >= minEncoded) {
        this.ensureBigEnough(l + 1);

        const maxVal = l === 0 ? minEncoded : minEncoded << 1;
        const byte = (2**8 - 2**(8 - l) + Math.floor(num / maxVal)) & 0xff;
        this.destination[this.offset] = byte;
        this.offset += 1;
        if (l > 0) {
          // encode the bytes of len `l`
          const rest = num % maxVal;
          this.iN(rest, l as 1 | 2 | 3 | 4);
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
   * extra length-descriminator (see [`u32`]) encoded in a compact form.
   *
   * https://graypaper.fluffylabs.dev/#WyJlMjA2ZTI2NjNjIiwiMzEiLCJBY2tub3dsZWRnZW1lbnRzIixudWxsLFsiPGRpdiBjbGFzcz1cInQgbTAgeDEzIGg2IHkxZGYzIGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+IiwiPGRpdiBjbGFzcz1cInQgbTAgeDEwIGhiIHkxZGY0IGZmNyBmczAgZmMwIHNjMCBsczAgd3MwXCI+Il1d
   */
  blob(blob: Uint8Array) {
    // first encode the length
    this.u32(blob.length);

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
    this.ensureBigEnough(bytes.length)

    this.destination.set(bytes.raw, this.offset);
    this.offset += bytes.length;
  }

  private ensureBigEnough(length: number) {
    const newLength = this.offset + length;
    if (newLength >= MAX_LENGTH) {
      throw new Error(`The encoded size would reach the maximum of ${MAX_LENGTH}.`);
    }

    if (newLength >= this.destination.length) {
      // we can try to resize the underlying buffer
      if (this.buffer) {
        this.buffer.resize(Math.min(MAX_LENGTH, this.buffer.byteLength * 2));
      }
      // and then check again
      if (newLength >= this.destination.length) {
        throw new Error(`Not enough space in the destination array. Needs ${newLength}, has ${this.destination.length}`);
      }
    }
  }
}

