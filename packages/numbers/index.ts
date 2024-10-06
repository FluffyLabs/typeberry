import type { Opaque } from "@typeberry/utils";

/** Unsigned integer that can be represented as two bytes. */
export type U16 = Opaque<number, "u16">;
/** Unsigned integer that can be represented as 4 bytes. */
export type U32 = Opaque<number, "u32">;
/** Unsigned integer that can be represented as 8 bytes. */
export type U64 = Opaque<bigint, "u64">;

// TODO [ToDr] Safe casting / math operations?
