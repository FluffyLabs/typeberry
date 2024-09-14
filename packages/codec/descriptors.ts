import {BitVec, BytesBlob} from "@typeberry/bytes";
import {Decode, Decoder} from "./decoder";
import {Encode, Encoder} from "./encoder";

export type Descriptor<T> = {
  name: string;
} & Encode<T> & Decode<T>;

export const VAR_U32 = descriptor<number>(
  "var_u32",
  (e, v) => e.varU32(v),
  (d) => d.varU32(),
);

export const VAR_U64 = descriptor<bigint>(
  "var_u64",
  (e, v) => e.varU64(v),
  (d) => d.varU64(),
);

export const U32 = descriptor<number>(
  "u32",
  (e, v) => e.i32(v),
  (d) => d.u32(),
);
export const U24 = descriptor<number>(
  "u24",
  (e, v) => e.i24(v),
  (d) => d.u24(),
);
export const U16 = descriptor<number>(
  "u16",
  (e, v) => e.i16(v),
  (d) => d.u16(),
);
export const U8 = descriptor<number>(
  "u8",
  (e, v) => e.i8(v),
  (d) => d.u8(),
);

export const I32 = descriptor<number>(
  "i32",
  (e, v) => e.i32(v),
  (d) => d.i32(),
);
export const I24 = descriptor<number>(
  "i24",
  (e, v) => e.i24(v),
  (d) => d.i24(),
);
export const I16 = descriptor<number>(
  "i16",
  (e, v) => e.i16(v),
  (d) => d.i16(),
);
export const I8 = descriptor<number>(
  "i8",
  (e, v) => e.i8(v),
  (d) => d.i8(),
);

export const BLOB = descriptor<BytesBlob>(
  "BytesBlob",
  (e, v) => e.bytesBlob(v),
  (d) => d.bytesBlob(),
);

export const BITVEC = descriptor<BitVec>(
  "BitVec",
  (e, v) => e.bitVecVarLen(v),
  (d) => d.bitVecVarLen(),
);


function descriptor<T>(
  name: string,
  encode: (e: Encoder, elem: T) => void,
  decode: (d: Decoder) => T
  // skip: (s: Skipper) // TODO [ToDr]
) {
  return {
    name,
    encode,
    decode,
  };
}
