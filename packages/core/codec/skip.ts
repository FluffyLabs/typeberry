import { type Decoder, decodeVariableLengthExtraBytes } from "./decoder.js";

/** An extension of a codec that can skip given value. */
export type Skip = {
  /** Skip all bytes occupied by the value. */
  skip: (s: Skipper) => void;
};

/** Wrapper for `Decoder` that can skip bytes of fields in the data buffer instead of decoding them. */
export class Skipper {
  constructor(public readonly decoder: Decoder) {}
  /** Skip U64/I64. */
  u64 = () => this.decoder.skip(8);
  /** Skip U32/I32. */
  u32 = () => this.decoder.skip(4);
  /** Skip U24/I24. */
  u24 = () => this.decoder.skip(3);
  /** Skip U16/I16. */
  u16 = () => this.decoder.skip(2);
  /** Skip U8/I8. */
  u8 = () => this.decoder.skip(1);
  /** Skip boolean. */
  bool = () => this.decoder.skip(1);
  /** Skip variable-length U32. */
  varU32 = () => this.varU64();
  /** Skip variable-length U64. */
  varU64() {
    const firstByte = this.decoder.u8();
    const l = decodeVariableLengthExtraBytes(firstByte);
    this.decoder.skip(l);
  }
  /** Skip fixed-length bytes. */
  bytes<N extends number>(len: N) {
    this.decoder.skip(len);
  }
  /** Skip variable-length bytes blob. */
  bytesBlob() {
    const len = this.decoder.varU32();
    this.decoder.skip(len);
  }
  /** Skip fixed-length bit vector. */
  bitVecFixLen(bitLength: number) {
    this.decoder.skip(Math.ceil(bitLength / 8));
  }
  /** Skip variable-length bit vector. */
  bitVecVarLen() {
    const len = this.decoder.varU32();
    this.bitVecFixLen(len);
  }
  /** Skip a composite object. */
  object(decode: Skip) {
    decode.skip(this);
  }
  /** Skip a potentially optional value. */
  optional(decode: Skip) {
    const isSet = this.decoder.bool();
    if (isSet) {
      decode.skip(this);
    }
  }
  /** Skip fixed-length sequence. */
  sequenceFixLen(decode: Skip, len: number) {
    for (let i = 0; i < len; i += 1) {
      decode.skip(this);
    }
  }
  /** Skip variable-length sequence. */
  sequenceVarLen(decode: Skip) {
    const len = this.decoder.varU32();
    return this.sequenceFixLen(decode, len);
  }
}
