import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export const HASH_SIZE = 32;

export type HeaderHash = Opaque<Bytes<typeof HASH_SIZE>, "HeaderHash">;

export type ExtrinsicHash = Opaque<Bytes<typeof HASH_SIZE>, "ExtrinsicHash">;
