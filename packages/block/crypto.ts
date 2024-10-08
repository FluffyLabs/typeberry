import type { Bytes } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";

// TODO [ToDr] Docs & GP references

export type Ed25519Key = Opaque<Bytes<32>, "Ed25519Key">;

export type Ed25519Signature = Opaque<Bytes<64>, "Ed25519Signature">;

export type BandersnatchKey = Opaque<Bytes<32>, "BandersnatchKey">;

export type BandersnatchRingSignature = Opaque<Bytes<784>, "BandersnatchRingSignature">;

export type BandersnatchVrfSignature = Opaque<Bytes<96>, "BandersnatchVrfSignature">;
