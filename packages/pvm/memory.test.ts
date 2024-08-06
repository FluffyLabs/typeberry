import assert from "node:assert";
import { describe, it } from "node:test";

import { Memory } from "./memory";
import { PageMap } from "./page-map";

describe("Memory", () => {
  describe("Initial memory", () => {
    it("should set initial memory", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const initialMemory = [{ address: 1, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const expectedMemory = [{ address: 1, contents: bytes }];

      const dump = memory.getMemoryDump();

      assert.deepStrictEqual(dump, expectedMemory);
    });
  });

  describe("Memory.store", () => {
    it("should store bytes at the beginning of a page", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const expectedMemory = [
        {
          address: 0,
          contents: bytes,
        },
      ];

      memory.store(0, bytes);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store bytes in the middle of a page", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const expectedMemory = [
        {
          address: 2000,
          contents: bytes,
        },
      ];

      memory.store(2000, bytes);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });
  });

  describe("Memory.load", () => {
    it("should load u8 from readable memory", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const initialMemory = [{ address: 1, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const expectedBytes = new Uint8Array([0xff]);

      const bytes = memory.load(1, 1);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load u16 from readable memory", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const initialMemory = [{ address: 1, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const expectedBytes = new Uint8Array([0xff, 0xee]);

      const bytes = memory.load(1, 2);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load u32 from readable memory", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const initialMemory = [{ address: 1, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
      const memory = new Memory(pageMap, initialMemory);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

      const bytes = memory.load(1, 4);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load [0, 0, 0, 0] in case of empty memory", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);
      const expectedBytes = new Uint8Array([0, 0, 0, 0]);

      const bytes = memory.load(1, 4);

      assert.deepStrictEqual(bytes, expectedBytes);
    });
  });

  describe("Memory.isReadable", () => {
    it("should return false when memory is not acissible", () => {
      const pageMap = new PageMap([]);
      const memory = new Memory(pageMap, []);

      const result = memory.isReadable(1);

      assert.deepStrictEqual(result, false);
    });

    it("should return true when memory is readable", () => {
      const pageMap = new PageMap([{ "is-writable": false, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);

      const result = memory.isReadable(1);

      assert.deepStrictEqual(result, true);
    });

    it("should return true when memory is writable", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);

      const result = memory.isReadable(1);

      assert.deepStrictEqual(result, true);
    });
  });

  describe("Memory.isWritable", () => {
    it("should return false when memory is not acissible", () => {
      const pageMap = new PageMap([]);
      const memory = new Memory(pageMap, []);

      const result = memory.isWritable(1);

      assert.deepStrictEqual(result, false);
    });

    it("should return false when memory is writable", () => {
      const pageMap = new PageMap([{ "is-writable": false, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);

      const result = memory.isWritable(1);

      assert.deepStrictEqual(result, false);
    });

    it("should return true when memory is writable", () => {
      const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
      const memory = new Memory(pageMap, []);

      const result = memory.isWritable(1);

      assert.deepStrictEqual(result, true);
    });
  });

  describe("Memory.getPageDump", () => {
    const pageMap = new PageMap([{ "is-writable": true, address: 0, length: 4096 }]);
    const initialMemory = [{ address: 1, contents: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) }];
    const memory = new Memory(pageMap, initialMemory);
    const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

    const pageDump = memory.getPageDump(0);

    assert.deepStrictEqual(pageDump, expectedBytes);
  });
});
