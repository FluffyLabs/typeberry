import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export type BlsKey = Opaque<Bytes<144>, "BlsKey">;
