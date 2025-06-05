import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import type { Blake2bHash } from "@typeberry/hash";
import { tryAsU32 } from "@typeberry/numbers";
import { SEED_SIZE, generateBandersnatchSecretKey, generateEd25519SecretKey, trivialSeed } from "./index";

describe("Key Generator: trivial seed", () => {
  it("should generate a valid seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    assert.deepStrictEqual(seed, Bytes.zero(SEED_SIZE));
  });
  it("should generate a valid seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        SEED_SIZE,
      ),
    );
  });
  it("should generate a valid seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
        SEED_SIZE,
      ),
    );
  });
  it("should generate a valid seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0],
        SEED_SIZE,
      ),
    );
  });
  it("should generate a valid seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0],
        SEED_SIZE,
      ),
    );
  });
  it("should generate a valid seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0],
        SEED_SIZE,
      ),
    );
  });
  it("should generate a valid seed: deadbeef", () => {
    const seed = trivialSeed(tryAsU32(0xdeadbeef));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [
          0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe,
          0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde, 0xef, 0xbe, 0xad, 0xde,
        ],
        SEED_SIZE,
      ),
    );
  });
});

describe("Key Generator: Ed25519 secret seed", () => {
  it("should generate from seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("996542becdf1e78278dc795679c825faca2e9ed2bf101bf3c4a236d3ed79cf59").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("b81e308145d97464d2bc92d35d227a9e62241a16451af6da5053e309be4f91d7").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("0093c8c10a88ebbc99b35b72897a26d259313ee9bad97436a437d2e43aaafa0f").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("69b3a7031787e12bfbdcac1b7a737b3e5a9f9450c37e215f6d3b57730e21001a").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("b4de9ebf8db5428930baa5a98d26679ab2a03eae7c791d582e6b75b7f018d0d4").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("4a6482f8f479e3ba2b845f8cef284f4b3208ba3241ed82caa1b5ce9fc6281730").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: f92d...d9d1", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    );
    const ed25519_seed = generateEd25519SecretKey(seed);
    assert.deepStrictEqual(
      ed25519_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("f21e2d96a51387f9a7e5b90203654913dde7fa1044e3eba5631ed19f327d6126").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });
});

describe("Key Generator: Bandersnatch secret seed", () => {
  it("should generate from seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("007596986419e027e65499cc87027a236bf4a78b5e8bd7f675759d73e7a9c799").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("12ca375c9242101c99ad5fafe8997411f112ae10e0e5b7c4589e107c433700ac").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("3d71dc0ffd02d90524fda3e4a220e7ec514a258c59457d3077ce4d4f003fd98a").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("107a9148b39a1099eeaee13ac0e3c6b9c256258b51c967747af0f8749398a276").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("0bb36f5ba8e3ba602781bb714e67182410440ce18aa800c4cb4dd22525b70409").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("75e73b8364bf4753c5802021c6aa6548cddb63fe668e3cacf7b48cdb6824bb09").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });

  it("should generate from seed: f92d...d9d1", () => {
    const seed = Bytes.fromBlob(
      Bytes.parseBlobNoPrefix("f92d680ea3f0ac06307795490d8a03c5c0d4572b5e0a8cffec87e1294855d9d1").raw,
      SEED_SIZE,
    );
    const bandersnatch_seed = generateBandersnatchSecretKey(seed);
    assert.deepStrictEqual(
      bandersnatch_seed,
      Bytes.fromBlob(
        Bytes.parseBlobNoPrefix("06154d857537a9b622a9a94b1aeee7d588db912bfc914a8a9707148bfba3b9d1").raw,
        SEED_SIZE,
      ).asOpaque<Blake2bHash>(),
    );
  });
});
