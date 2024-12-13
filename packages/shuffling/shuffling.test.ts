import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { fisherYatesShuffle } from "./shuffling";

function prepareArrayToShuffle(length: number) {
  return Array.from({ length }, (_, i) => i);
}

describe("fisherYatesShuffle", () => {
  it("should do nothing with array of length 0", () => {
    const data = prepareArrayToShuffle(0);
    const entropy = Bytes.zero(32);
    const expectedData: number[] = [];

    const result = fisherYatesShuffle(data, entropy);

    assert.deepStrictEqual(result, expectedData);
  });

  it("should do nothing with array of length 1", () => {
    const data = prepareArrayToShuffle(1);
    const entropy = Bytes.zero(32);
    const expectedData = [0];

    const result = fisherYatesShuffle(data, entropy);

    assert.deepStrictEqual(result, expectedData);
  });

  it("should correcty shuffle an array of length 7", () => {
    const data = prepareArrayToShuffle(7);
    const entropy = Bytes.zero(32);
    const expectedData = [0, 1, 4, 5, 3, 6, 2];
    const result = fisherYatesShuffle(data, entropy);

    assert.deepStrictEqual(result, expectedData);
  });

  it("should correcty shuffle an array of length 37", () => {
    const data = prepareArrayToShuffle(37);
    const entropy = Bytes.zero(32);
    const expectedData = [
      9, 13, 14, 29, 28, 22, 25, 32, 16, 36, 31, 7, 34, 20, 33, 12, 8, 27, 11, 3, 0, 17, 21, 24, 5, 2, 15, 18, 6, 26,
      23, 4, 19, 30, 35, 1, 10,
    ];

    const result = fisherYatesShuffle(data, entropy);

    assert.deepStrictEqual(result, expectedData);
  });
});
