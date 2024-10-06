import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

export type BandersnatchKey = Opaque<Bytes<32>, "BandersnatchKey">;
export type BandersnatchRingSignature = Opaque<Bytes<784>, "BandersnatchRingSignature">;
export type BlsKey = Opaque<Bytes<144>, "BlsKey">;
export type Ed25519Key = Opaque<Bytes<32>, "Ed25519Key">;
