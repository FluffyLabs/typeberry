import assert from "node:assert";
import { describe, it } from "node:test";

import { PageMap } from "./page-map";

describe("PageMap", () => {
  describe("PageMap.isWritable", () => {
    it("should return true", () => {
      const address = 4097;
      const initialPageMap = [
        {
          address: 4096,
          "is-writable": true,
          length: 4096,
        },
      ];
      const pageMap = new PageMap(initialPageMap);

      const result = pageMap.isWritable(address);

      assert.strictEqual(result, true);
    });

    it("should return false", () => {
      const address = 4097;
      const initialPageMap = [
        {
          address: 4096,
          "is-writable": false,
          length: 4096,
        },
      ];
      const pageMap = new PageMap(initialPageMap);

      const result = pageMap.isWritable(address);

      assert.strictEqual(result, false);
    });

    it("should return false (no item)", () => {
      const address = 4097;
      const pageMap = new PageMap([]);

      const result = pageMap.isWritable(address);

      assert.strictEqual(result, false);
    });
  });

  describe("PageMap.isReadable", () => {
    it("should return true", () => {
      const address = 4097;
      const initialPageMap = [
        {
          address: 4096,
          "is-writable": true,
          length: 4096,
        },
      ];
      const pageMap = new PageMap(initialPageMap);

      const result = pageMap.isReadable(address);

      assert.strictEqual(result, true);
    });

    it("should return false", () => {
      const address = 4097;
      const initialPageMap = [
        {
          address: 4096,
          "is-writable": false,
          length: 4096,
        },
      ];
      const pageMap = new PageMap(initialPageMap);

      const result = pageMap.isReadable(address);

      assert.strictEqual(result, true);
    });

    it("should return false (no item)", () => {
      const address = 4097;
      const pageMap = new PageMap([]);

      const result = pageMap.isReadable(address);

      assert.strictEqual(result, false);
    });
  });

  describe("PageMap.getPageSize", () => {
    it("should return true", () => {
      const length = 4096;
      const initialPageMap = [
        {
          address: 4096,
          "is-writable": true,
          length,
        },
      ];
      const pageMap = new PageMap(initialPageMap);

      const result = pageMap.getPageSize();

      assert.strictEqual(result, length);
    });
  });
});
