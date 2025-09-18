import assert from "node:assert";
import { before, describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { SimpleAllocator } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import type { BandersnatchKey } from "./bandersnatch.js";
import type { Ed25519Key } from "./ed25519.js";
import { initWasm } from "./index.js";
import {
  type BandersnatchSecretSeed,
  deriveBandersnatchPublicKey,
  deriveBandersnatchSecretKey,
  deriveEd25519PublicKey,
  deriveEd25519SecretKey,
  type Ed25519SecretSeed,
  type KeySeed,
  SEED_SIZE,
  trivialSeed,
} from "./key-derivation.js";

before(initWasm);

describe("Key Derivation: trivial seed", () => {
  it("should derive a valid seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    assert.deepStrictEqual(seed, Bytes.zero(SEED_SIZE));
  });
  it("should derive a valid seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
  it("should derive a valid seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
  it("should derive a valid seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
  it("should derive a valid seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
  it("should derive a valid seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
  it("should derive a valid seed: deadbeef", () => {
    const seed = trivialSeed(tryAsU32(0xdeadbeef));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [
          0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe,
          0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde,
        ],
        SEED_SIZE,
      ).asOpaque<KeySeed>(),
    );
  });
});

describe("Key Derivation: Ed25519 secret seed", () => {
  const allocator = new SimpleAllocator();

  it("should derive from seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("b81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("69b3a7031787e12bfbdcac1b7a737b3e5a9f9450c37e215f6d3b57730e21001a").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("b4de9ebf8db5428930baa5a98d26679ab2a03eae7c791d582e6b75b7f018d0d4").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("4a6482f8f479e3ba2b845f8cef284f4b3208ba3241ed82caa1b5ce9fc6281730").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });

  it("should derive from seed: f92d...d9d1", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    ).asOpaque<KeySeed>();
    const ed25519_seed = deriveEd25519SecretKey(seed, allocator);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("f21e2d96a51387f9a7e5b90203654913dde7fa1044e3eba5631ed19f327d6126").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519SecretSeed>(),
    );
  });
});

describe("Key Derivation: Ed25519 public key", () => {
  const allocator = new SimpleAllocator();

  it("should derive from seed: 0", async () => {
    const seed = trivialSeed(tryAsU32(0));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: 1", async () => {
    const seed = trivialSeed(tryAsU32(1));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("ad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: 2", async () => {
    const seed = trivialSeed(tryAsU32(2));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("cab2b9ff25c2410fbe9b8a717abb298c716a03983c98ceb4def2087500b8e341").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: 3", async () => {
    const seed = trivialSeed(tryAsU32(3));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("f30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: 4", async () => {
    const seed = trivialSeed(tryAsU32(4));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: 5", async () => {
    const seed = trivialSeed(tryAsU32(5));
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("ab0084d01534b31c1dd87c81645fd762482a90027754041ca1b56133d0466c06").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });

  it("should derive from seed: f92d...d9d1", async () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    ).asOpaque<KeySeed>();
    const ed25519_secret_seed = deriveEd25519SecretKey(seed, allocator);
    const ed25519_public_key = await deriveEd25519PublicKey(ed25519_secret_seed);
    assert.deepStrictEqual(
      ed25519_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("11a695f674de95ff3daaff9a5b88c18448b10156bf88bc04200e48d5155c7243").raw,
        SEED_SIZE,
      ).asOpaque<Ed25519Key>(),
    );
  });
});

describe("Key Derivation: Bandersnatch secret seed", () => {
  const allocator = new SimpleAllocator();

  it("should derive from seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("107a9148b39a1099eeaee13ac0e3c6b9c256258b51c967747af0f8749398a276").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("0bb36f5ba8e3ba602781bb714e67182410440ce18aa800c4cb4dd22525b70409").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("75e73b8364bf4753c5802021c6aa6548cddb63fe668e3cacf7b48cdb6824bb09").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });

  it("should derive from seed: f92d...d9d1", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    ).asOpaque<KeySeed>();
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("06154d857537a9b622a9a94b1aeee7d588db912bfc914a8a9707148bfba3b9d1").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchSecretSeed>(),
    );
  });
});

describe("Key Derivation: Bandersnatch public key", () => {
  const allocator = new SimpleAllocator();

  it("should derive from seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("ff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("dee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("9326edb21e5541717fde24ec085000b28709847b8aab1ac51f84e94b37ca1b66").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981cc").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("2105650944fcd101621fd5bb3124c9fd191d114b7ad936c1d79d734f9f21392e").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });

  it("should derive from seed: f92d...d9d1", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    ).asOpaque<KeySeed>();
    const bandersnatch_seed = deriveBandersnatchSecretKey(seed, allocator);
    const bandersnatch_public_key = deriveBandersnatchPublicKey(bandersnatch_seed);
    assert.deepStrictEqual(
      bandersnatch_public_key,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("299bdfd8d615aadd9e6c58718f9893a5144d60e897bc9da1f3d73c935715c650").raw,
        SEED_SIZE,
      ).asOpaque<BandersnatchKey>(),
    );
  });
});
