import { Ordering } from "@typeberry/ordering";
import { TEST_COMPARE_VIA_STRING, asOpaqueType, check } from "@typeberry/utils";

/**
 * A variable-length blob of bytes with a concise text representation.
 *
 * The structure is used as convenience wrapper for [`Uint8Array`],
 * especially if the data is coming from a hex-encoded string.
 */
export class BytesBlob {
  [TEST_COMPARE_VIA_STRING] = true;

  readonly raw: Uint8Array;
  readonly length: number = 0;

  protected constructor(data: Uint8Array) {
    this.raw = data;
    this.length = data.byteLength;
  }

  /**
   * Display a hex-encoded version of this byte blob.
   */
  toString() {
    return bytesToHexString(this.raw);
  }

  /** Decode contained bytes as string. */
  asText() {
    const decoder = new TextDecoder();
    return decoder.decode(this.raw);
  }

  /** Converts current type into some opaque extension. */
  asOpaque() {
    return asOpaqueType(this);
  }

  /** Compare the sequence to another one. */
  isEqualTo(other: BytesBlob): boolean {
    if (this.length !== other.length) {
      return false;
    }

    return u8ArraySameLengthEqual(this.raw, other.raw);
  }

  /** Compare the sequence to another one lexicographically.
   *  Returns `Ordering.Less` if "this" blob is less than (or shorter than) "other", `Ordering.Equal` if blobs are identical and `Ordering.Greater` otherwise.
   *  https://graypaper.fluffylabs.dev/#/5f542d7/07c40007c400
   */
  public compare(other: BytesBlob): Ordering {
    const min = Math.min(this.length, other.length);
    const thisRaw = this.raw;
    const otherRaw = other.raw;

    for (let i = 0; i < min; i++) {
      if (thisRaw[i] < otherRaw[i]) {
        return Ordering.Less;
      }

      if (thisRaw[i] > otherRaw[i]) {
        return Ordering.Greater;
      }
    }

    if (this.length < other.length) {
      return Ordering.Less;
    }

    if (this.length > other.length) {
      return Ordering.Greater;
    }

    return Ordering.Equal;
  }

  /**
   * @deprecated Use `compare` instead.
   */
  isLessThan(other: BytesBlob): boolean {
    return this.compare(other) === Ordering.Less;
  }

  /**
   * @deprecated Use `compare` instead.
   */
  isLessThanOrEqualTo(other: BytesBlob): boolean {
    return this.compare(other) !== Ordering.Greater;
  }

  /** Create a new [`BytesBlob'] by converting given UTF-u encoded string into bytes. */
  static blobFromString(v: string): BytesBlob {
    const encoder = new TextEncoder();
    return BytesBlob.blobFrom(encoder.encode(v));
  }

  /** Create a new [`BytesBlob`] from existing [`Uint8Array`]. */
  static blobFrom(v: Uint8Array): BytesBlob {
    return new BytesBlob(v);
  }

  /** Create a new [`BytesBlob`] by concatenating data from multiple `Uint8Array`s. */
  static blobFromParts(v: Uint8Array | Uint8Array[], ...rest: Uint8Array[]) {
    const vArr = v instanceof Uint8Array ? [v] : v;
    const totalLength = vArr.reduce((a, v) => a + v.length, 0) + rest.reduce((a, v) => a + v.length, 0);
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const r of vArr) {
      buffer.set(r, offset);
      offset += r.length;
    }
    for (const r of rest) {
      buffer.set(r, offset);
      offset += r.length;
    }
    return new BytesBlob(buffer);
  }

  /** Create a new [`BytesBlob`] from an array of bytes. */
  static blobFromNumbers(v: number[]): BytesBlob {
    check(v.find((x) => (x & 0xff) !== x) === undefined, "BytesBlob.blobFromNumbers used with non-byte number array.");
    const arr = new Uint8Array(v);
    return new BytesBlob(arr);
  }

  /** Parse a hex-encoded bytes blob without `0x` prefix. */
  static parseBlobNoPrefix(v: string): BytesBlob {
    const len = v.length;
    if (len % 2 === 1) {
      throw new Error(`Odd number of nibbles. Invalid hex string: ${v}.`);
    }
    const buffer = new ArrayBuffer(len / 2);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < len - 1; i += 2) {
      const c = v.substring(i, i + 2);
      bytes[i / 2] = byteFromString(c);
    }

    return new BytesBlob(bytes);
  }

  /** Parse a hex-encoded bytes blob with `0x` prefix. */
  static parseBlob(v: string): BytesBlob {
    if (!v.startsWith("0x")) {
      throw new Error(`Missing 0x prefix: ${v}.`);
    }
    return BytesBlob.parseBlobNoPrefix(v.substring(2));
  }

  /**
    * Split `BytesBlob` into chunks of given size.
    * 
    * Last chunk might be smaller than `size`.
    */
  *chunks(size: number): Generator<BytesBlob> {
    for (let i = 0; i < this.length; i += size) {
      yield BytesBlob.blobFrom(this.raw.subarray(i, i + size));
    }
  }
}

/**
 * A convenience wrapper for a fix-length sequence of bytes.
 */
export class Bytes<T extends number> extends BytesBlob {
  /** Length of the bytes array. */
  readonly length: T;

  private constructor(raw: Uint8Array, len: T) {
    super(raw);
    check(raw.byteLength === len, `Given buffer has incorrect size ${raw.byteLength} vs expected ${len}`);
    this.length = len;
  }

  /** Create new [`Bytes<X>`] given a backing buffer and it's length. */
  static fromBlob<X extends number>(v: Uint8Array, len: X): Bytes<X> {
    return new Bytes(v, len);
  }

  /** Create new [`Bytes<X>`] given an array of bytes and it's length. */
  static fromNumbers<X extends number>(v: number[], len: X): Bytes<X> {
    check(v.find((x) => (x & 0xff) !== x) === undefined, "Bytes.fromNumbers used with non-byte number array.");
    const x = new Uint8Array(v);
    return new Bytes(x, len);
  }

  /** Create an empty [`Bytes<X>`] of given length. */
  static zero<X extends number>(len: X): Bytes<X> {
    return new Bytes(new Uint8Array(len), len);
  }

  /** Create a [`Bytes<X>`] with all bytes filled with given input number. */
  static fill<X extends number>(len: X, input: number): Bytes<X> {
    check((input & 0xff) === input, "Input has to be a byte.");
    const bytes = Bytes.zero(len);
    bytes.raw.fill(input, 0, len);
    return bytes;
  }

  /** Parse a hex-encoded fixed-length bytes without `0x` prefix. */
  static parseBytesNoPrefix<X extends number>(v: string, len: X): Bytes<X> {
    if (v.length > 2 * len) {
      throw new Error(`Input string too long. Expected ${len}, got ${v.length / 2}`);
    }

    const blob = BytesBlob.parseBlobNoPrefix(v);
    return new Bytes(blob.raw, len);
  }

  /** Parse a hex-encoded fixed-length bytes with `0x` prefix. */
  static parseBytes<X extends number>(v: string, len: X): Bytes<X> {
    if (v.length > 2 * len + 2) {
      throw new Error(`Input string too long. Expected ${len}, got ${v.length / 2 - 1}`);
    }

    const blob = BytesBlob.parseBlob(v);
    return new Bytes(blob.raw, len);
  }

  /** Compare the sequence to another one. */
  isEqualTo(other: Bytes<T>): boolean {
    check(this.length === other.length, "Comparing incorrectly typed bytes!");
    return u8ArraySameLengthEqual(this.raw, other.raw);
  }
}

function byteFromString(s: string): number {
  check(s.length === 2, "Two-character string expected");
  const a = numberFromCharCode(s.charCodeAt(0));
  const b = numberFromCharCode(s.charCodeAt(1));
  return (a << 4) | b;
}

const CODE_OF_0 = "0".charCodeAt(0);
const CODE_OF_9 = "9".charCodeAt(0);
const CODE_OF_a = "a".charCodeAt(0);
const CODE_OF_f = "f".charCodeAt(0);
const CODE_OF_A = "A".charCodeAt(0);
const CODE_OF_F = "F".charCodeAt(0);
const VALUE_OF_A = 0xa;

function numberFromCharCode(x: number) {
  if (x >= CODE_OF_0 && x <= CODE_OF_9) {
    return x - CODE_OF_0;
  }

  if (x >= CODE_OF_a && x <= CODE_OF_f) {
    return x - CODE_OF_a + VALUE_OF_A;
  }

  if (x >= CODE_OF_A && x <= CODE_OF_F) {
    return x - CODE_OF_A + VALUE_OF_A;
  }

  throw new Error(`Invalid characters in hex byte string: ${String.fromCharCode(x)}`);
}

function bytesToHexString(buffer: Uint8Array): string {
  const nibbleToString = (n: number) => {
    if (n >= VALUE_OF_A) {
      return String.fromCharCode(n + CODE_OF_a - VALUE_OF_A);
    }
    return String.fromCharCode(n + CODE_OF_0);
  };

  let s = "0x";
  for (const v of buffer) {
    s += nibbleToString(v >>> 4);
    s += nibbleToString(v & 0xf);
  }
  return s;
}

function u8ArraySameLengthEqual(self: Uint8Array, other: Uint8Array) {
  for (let i = 0; i < self.length; i += 1) {
    if (self[i] !== other[i]) {
      return false;
    }
  }
  return true;
}
