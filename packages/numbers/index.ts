// TODO [ToDr] This should be `unique symbol`, but for some reason
// I can't figure out how to build `@typeberry/blocks` package.
declare const __REPRESENTATION_BYTES__: "REPRESENTATION_BYTES";

type WithBytesRepresentation<Bytes extends number> = {
  readonly [__REPRESENTATION_BYTES__]: Bytes;
};
export type FixedSizeNumber<Bytes extends number> = number & WithBytesRepresentation<Bytes>;

/** Unsigned integer that can be represented as one byte. */
export type U8 = FixedSizeNumber<1>;
/** Unsigned integer that can be represented as two bytes. */
export type U16 = FixedSizeNumber<2>;
/** Unsigned integer that can be represented as 4 bytes. */
export type U32 = FixedSizeNumber<4>;
/** Unsigned integer that can be represented as 8 bytes. */
export type U64 = bigint & WithBytesRepresentation<8>;

// TODO [ToDr] Safe casting / math operations?
