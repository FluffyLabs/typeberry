import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import type { BandersnatchKey } from "./bandersnatch.js";
import { type BandersnatchSecretSeed, SEED_SIZE, deriveBandersnatchPublicKey } from "./key-derivation.js";

describe("BandersnatchKey Derivation", () => {
  it("should derive a valid Bandersnatch public key from a secret seed", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799").raw,
      SEED_SIZE,
    ).asOpaque<BandersnatchSecretSeed>();
    const publicKey = deriveBandersnatchPublicKey(seed);
    const expected = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3").raw,
      SEED_SIZE,
    ).asOpaque<BandersnatchKey>();
    assert.deepEqual(publicKey, expected);
  });
});
