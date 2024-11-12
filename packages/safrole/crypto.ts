import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export const BLS_KEY_BYTES = 144;
export type BLS_KEY_BYTES = typeof BLS_KEY_BYTES;
export type BlsKey = Opaque<Bytes<BLS_KEY_BYTES>, "BlsKey">;
