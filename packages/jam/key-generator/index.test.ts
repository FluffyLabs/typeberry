import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { tryAsU32 } from "@typeberry/numbers";
import { trivialSeed } from "./index";

describe("Key Generator: trivial seed", () => {
  it("should generate a valid seed: 0", () => {
    const seed = trivialSeed(tryAsU32(0));
    assert.deepStrictEqual(seed, Bytes.zero(32));
  });
  it("should generate a valid seed: 1", () => {
    const seed = trivialSeed(tryAsU32(1));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        32,
      ),
    );
  });
  it("should generate a valid seed: 2", () => {
    const seed = trivialSeed(tryAsU32(2));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0],
        32,
      ),
    );
  });
  it("should generate a valid seed: 3", () => {
    const seed = trivialSeed(tryAsU32(3));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0],
        32,
      ),
    );
  });
  it("should generate a valid seed: 4", () => {
    const seed = trivialSeed(tryAsU32(4));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0],
        32,
      ),
    );
  });
  it("should generate a valid seed: 5", () => {
    const seed = trivialSeed(tryAsU32(5));
    assert.deepStrictEqual(
      seed,
      Bytes.fromNumbers(
        [5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0, 5, 0, 0, 0],
        32,
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
        32,
      ),
    );
  });
});
