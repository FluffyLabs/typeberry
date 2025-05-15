import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsValidatorIndex } from "@typeberry/block";
import { Judgement } from "@typeberry/block/disputes";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { isUniqueSortedBy, isUniqueSortedByIndex } from "./sort-utils";

describe("sort-utils", () => {
  describe("isUniqueSortedBy", () => {
    const buildTestData = (key: string, arrays: number[][]) => ({
      data: arrays.map((arr) => ({ [key]: BytesBlob.blobFromNumbers(arr) })),
      key,
    });

    it("should return true for an empty array", () => {
      const { key, data } = buildTestData("a", []);

      const result = isUniqueSortedBy(data, key);

      assert.strictEqual(result, true);
    });

    it("should return false in case of the same blobs in array", () => {
      const { key, data } = buildTestData("a", [
        [1, 2],
        [1, 2],
      ]);

      const result = isUniqueSortedBy(data, key);

      assert.strictEqual(result, false);
    });

    it("should return false in case of descending order in array", () => {
      const { key, data } = buildTestData("a", [
        [2, 1],
        [1, 2],
      ]);

      const result = isUniqueSortedBy(data, key);

      assert.strictEqual(result, false);
    });

    it("should return true in case of ascending order in array", () => {
      const { key, data } = buildTestData("a", [
        [1, 2],
        [2, 1],
      ]);

      const result = isUniqueSortedBy(data, key);

      assert.strictEqual(result, true);
    });
  });

  describe("isUniqueSortedByIndex", () => {
    const buildTestData = (indices: number[]) =>
      indices.map((index) =>
        Judgement.create({
          isWorkReportValid: true,
          index: tryAsValidatorIndex(index),
          signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
        }),
      );

    it("should return true for an empty array", () => {
      const judgements = buildTestData([]);

      const result = isUniqueSortedByIndex(judgements);

      assert.strictEqual(result, true);
    });

    it("should return false in case of duplicates in array", () => {
      const judgements = buildTestData([1, 1]);

      const result = isUniqueSortedByIndex(judgements);

      assert.strictEqual(result, false);
    });

    it("should return false in case of descending order in array", () => {
      const judgements = buildTestData([2, 1]);

      const result = isUniqueSortedByIndex(judgements);

      assert.strictEqual(result, false);
    });

    it("should return true in case of ascending order in array", () => {
      const judgements = buildTestData([1, 2]);

      const result = isUniqueSortedByIndex(judgements);

      assert.strictEqual(result, true);
    });
  });
});
