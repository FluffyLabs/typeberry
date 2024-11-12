import { Bytes, BytesBlob } from "@typeberry/bytes";
import { BitVec } from "@typeberry/bytes";
import { type U8, type U16, type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import { check } from "@typeberry/utils";

/** A decoder for some specific type `T` */
export type Decode<T> = {
  /** Decode object of type `T`. */
  decode: (d: Decoder) => T;
};

/** Primitives decoder for JAM codec. */
export class Decoder {
  /**
   * Create a new [`Decoder`] instance from given bytes blob and starting offset.
   */
  static fromBytesBlob(source: BytesBlob, offset?: number) {
    return new Decoder(source.raw, offset);
  }

  /**
   * Create a new [`Decoder`] instance given a raw array of bytes as a source.
   */
  static fromBlob(source: Uint8Array) {
    return new Decoder(source);
  }

  /**
   * Decode a single object from all of the source bytes.
   *
   * NOTE that if you need to decode multiple objects, it might be better
   * to create a [`Decoder`] instance intstead of slicing the data.
   */
  static decodeObject<T>(decode: Decode<T>, source: BytesBlob | Uint8Array, context?: unknown): T {
    const decoder = source instanceof BytesBlob ? Decoder.fromBytesBlob(source) : Decoder.fromBlob(source);
    decoder.attachContext(context);
    const obj = decoder.object(decode);
    decoder.finish();
    return obj;
  }

  private readonly dataView: DataView;

  private constructor(
    public readonly source: Uint8Array,
    private offset = 0,
    private context?: unknown,
  ) {
    this.dataView = new DataView(source.buffer, source.byteOffset, source.byteLength);
  }

  /**
   * Attach context to the decoder.
   *
   * The context object can be used to pass some "global" parameters
   * down to custom decoders.
   */
  attachContext(context?: unknown) {
    this.context = context;
  }

  /**
   * Get the decoding context object.
   */
  getContext(): unknown {
    return this.context;
  }

  /**
   * Return a copy of this decoder.
   *
   * The copy will maintain it's own `offset` within the source.
   */
  clone(): Decoder {
    return new Decoder(this.source, this.offset, this.context);
  }

  /**
   * Return the number of bytes read from the source
   * (i.e. current offset within the source).
   */
  bytesRead(): number {
    return this.offset;
  }

  /** Decode single byte as a signed number. */
  i8(): number {
    return this.getNum(1, () => this.dataView.getInt8(this.offset));
  }

  /** Decode single byte as an unsigned number. */
  u8(): U8 {
    return this.getNum(1, () => this.dataView.getUint8(this.offset)) as U8;
  }

  /** Decode two bytes as a signed number. */
  i16(): number {
    return this.getNum(2, () => this.dataView.getInt16(this.offset, true));
  }

  /** Decode two bytes as an unsigned number. */
  u16(): U16 {
    return this.getNum(2, () => this.dataView.getUint16(this.offset, true)) as U16;
  }

  /** Decode three bytes as a signed number. */
  i24(): number {
    const num = this.u24();
    return num >= 2 ** 23 ? num - 2 ** 24 : num;
  }

  /** Decode three bytes as an unsigned number. */
  u24(): number {
    return this.getNum(3, () => {
      let num = this.dataView.getUint8(this.offset);
      num |= this.dataView.getUint16(this.offset + 1, true) << 8;
      return num;
    });
  }

  /** Decode 4 bytes as a signed number. */
  i32(): number {
    return this.getNum(4, () => this.dataView.getInt32(this.offset, true));
  }

  /** Decode 4 bytes as an unsigned number. */
  u32(): U32 {
    return this.getNum(4, () => this.dataView.getUint32(this.offset, true)) as U32;
  }

  /** Decode 8 bytes as a signed number. */
  i64(): bigint {
    return this.getNum(8, () => this.dataView.getBigInt64(this.offset, true));
  }

  /** Decode 8 bytes as a unsigned number. */
  u64(): U64 {
    return this.getNum(8, () => this.dataView.getBigUint64(this.offset, true)) as U64;
  }

  /**
   * Decode a boolean discriminator.
   *
   * NOTE: this method will throw an exception in case the encoded
   *       byte is neither 0 nor 1.
   */
  bool(): boolean {
    const num = this.u8();
    if (num === 0) {
      return false;
    }

    if (num === 1) {
      return true;
    }

    throw new Error(`Unexpected number when decoding a boolean: ${num}`);
  }

  /**
   * Decode a variable-length encoding of natural numbers (up to 2**32).
   *
   * NOTE: this method will panic in case a larger number is found
   *       in the source.
   */
  varU32(): U32 {
    const firstByte = this.source[this.offset];
    const l = decodeLengthAfterFirstByte(firstByte);
    this.offset += 1;

    if (l === 0) {
      return firstByte as U32;
    }

    if (l > 4) {
      throw new Error(`Unexpectedly large value for u32. l=${l}`);
    }

    const mostSignificantByte = (firstByte + 2 ** (8 - l) - 2 ** 8) << (l * 8);
    if (l === 1) {
      return (mostSignificantByte + this.u8()) as U32;
    }

    if (l === 2) {
      return (mostSignificantByte + this.u16()) as U32;
    }

    if (l === 3) {
      return (mostSignificantByte + this.u24()) as U32;
    }

    if (mostSignificantByte === 0) {
      return this.u32();
    }

    throw new Error(`Unexpectedly large value for u32. l=${l}, mostSignificantByte=${mostSignificantByte}`);
  }

  /** Decode a variable-length encoding of natural numbers (up to 2**64). */
  varU64(): U64 {
    const firstByte = this.source[this.offset];
    const l = decodeLengthAfterFirstByte(firstByte);
    this.offset += 1;

    if (l === 0) {
      return tryAsU64(firstByte);
    }

    this.offset += l;
    if (l === 8) {
      return tryAsU64(this.dataView.getBigUint64(this.offset - l, true));
    }

    let num = BigInt(firstByte + 2 ** (8 - l) - 2 ** 8) << BigInt(8 * l);
    for (let i = 0; i < l; i += 1) {
      num |= BigInt(this.source[this.offset - l + i]) << BigInt(8 * i);
    }
    return tryAsU64(num);
  }

  /** Decode a fixed-length sequence of bytes. */
  bytes<N extends number>(len: N): Bytes<N> {
    if (len === 0) {
      return Bytes.zero(len);
    }

    this.ensureHasBytes(len);
    const bytes = this.source.subarray(this.offset, this.offset + len);
    this.offset += len;
    return Bytes.fromBlob(bytes, len);
  }

  /** Decode a variable-length sequence of bytes. */
  bytesBlob(): BytesBlob {
    const len = this.varU32();
    this.ensureHasBytes(len);
    const bytes = this.source.subarray(this.offset, this.offset + len);
    this.offset += len;
    return BytesBlob.blobFrom(bytes);
  }

  /** Decode a fixed-length sequence of bits of given length. */
  bitVecFixLen(bitLength: number): BitVec {
    if (bitLength === 0) {
      return BitVec.empty(0);
    }

    const byteLength = Math.ceil(bitLength / 8);
    const bytes = this.bytes(byteLength);

    // verify that the remaining bits are zero
    const emptyBitsStart = bitLength % 8;
    if (emptyBitsStart > 0) {
      const lastByte = bytes.raw[byteLength - 1];
      const emptyBits = lastByte >> emptyBitsStart;
      if (emptyBits > 0) {
        throw new Error("Non-zero bits found in the last byte of bitvec encoding.");
      }
    }

    return BitVec.fromBytes(bytes, bitLength);
  }

  /** Decode a variable-length sequence of bits. */
  bitVecVarLen(): BitVec {
    const bitLength = this.varU32();
    return this.bitVecFixLen(bitLength);
  }

  /** Decode a composite object. */
  object<T>(decode: Decode<T>): T {
    return decode.decode(this);
  }

  /** Decode a possibly optional value. */
  optional<T>(decode: Decode<T>): T | null {
    const isSet = this.bool();
    if (!isSet) {
      return null;
    }
    return decode.decode(this);
  }

  /** Decode a known-length sequence of elements. */
  sequenceFixLen<T>(decode: Decode<T>, len: number): T[] {
    const result = Array<T>(len);
    for (let i = 0; i < len; i += 1) {
      result[i] = decode.decode(this);
    }
    return result;
  }

  /** Decode a variable-length sequence of elements. */
  sequenceVarLen<T>(decode: Decode<T>): T[] {
    const len = this.varU32();
    return this.sequenceFixLen(decode, len);
  }

  /**
   * Move the decoding cursor to given offset.
   *
   * Note the offset can actually be smaller than the current offset
   * (i.e. one can go back).
   */
  resetTo(newOffset: number) {
    if (this.offset < newOffset) {
      this.skip(newOffset - this.offset);
    } else {
      check(newOffset >= 0, "The offset has to be positive");
      this.offset = newOffset;
    }
  }

  /** Skip given number of bytes for decoding. */
  skip(bytes: number) {
    this.ensureHasBytes(bytes);
    this.offset += bytes;
  }

  /**
   * Finish decoding `source` object and make sure there is no data left.
   *
   * This method can be called when the entire object that was meant to be
   * stored in the `source` is now fully decoded and we want to ensure
   * that there is no extra bytes contained in the `source`.
   */
  finish() {
    if (this.offset < this.source.length) {
      throw new Error(`Expecting end of input, yet there are still ${this.source.length - this.offset} bytes left.`);
    }
  }

  private getNum<T>(bytes: number, f: () => T) {
    this.ensureHasBytes(bytes);
    const num = f();
    this.offset += bytes;
    return num;
  }

  private ensureHasBytes(bytes: number) {
    check(bytes >= 0, "Negative number of bytes given.");
    if (this.offset + bytes > this.source.length) {
      throw new Error(
        `Attempting to decode more data than there is left. Need ${bytes}, left: ${this.source.length - this.offset}.`,
      );
    }
  }
}

const MASKS = [0xff, 0xfe, 0xfc, 0xf8, 0xf0, 0xe0, 0xc0, 0x80];
function decodeLengthAfterFirstByte(firstByte: number) {
  check(firstByte >= 0 && firstByte < 256, `Incorrect byte value: ${firstByte}`);
  for (let i = 0; i < MASKS.length; i++) {
    if (firstByte >= MASKS[i]) {
      return 8 - i;
    }
  }

  return 0;
}
