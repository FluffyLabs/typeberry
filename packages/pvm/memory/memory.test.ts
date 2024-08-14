import assert from "node:assert";
import { describe, it } from "node:test";

import { Memory } from "./memory";
import { PAGE_SIZE, SEGMENT_SIZE, STACK_SEGMENT } from "./memory-conts";
import { PageFault } from "./page-fault";

describe("Memory", () => {
  describe("Initial memory", () => {
    it("should set readonly segment", () => {
      const initialMemory = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const memory = new Memory();
      memory.setupMemory(initialMemory, new Uint8Array(), 0, 0);
      const expectedMemory = [{ address: SEGMENT_SIZE, contents: initialMemory }];

      const dump = memory.getMemoryDump();

      assert.deepStrictEqual(dump, expectedMemory);
    });

    it("should set heap segment", () => {
      const initialMemory = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), initialMemory, 0, 0);
      const expectedMemory = [{ address: 2 * SEGMENT_SIZE, contents: initialMemory }];

      const dump = memory.getMemoryDump();

      assert.deepStrictEqual(dump, expectedMemory);
    });

    it("should set additional readonly segment", () => {
      const initialMemory = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const memory = new Memory();
      memory.setupAdditionalReadOnlySegment(initialMemory);
      const expectedMemory = [{ address: STACK_SEGMENT, contents: initialMemory }];

      const dump = memory.getMemoryDump();

      assert.deepStrictEqual(dump, expectedMemory);
    });
  });

  describe("Memory.store", () => {
    it("should not store bytes in readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(5), new Uint8Array(), 0, 0);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const address = SEGMENT_SIZE;
      const expected = PageFault;

      const store = () => memory.store(address, bytes);

      assert.throws(store, expected);
    });

    it("should store bytes in heap segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(5), 0, 0);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const address = 2 * SEGMENT_SIZE;
      const expectedMemory = [
        {
          address,
          contents: bytes,
        },
      ];

      memory.store(address, bytes);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should store bytes in stack segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(), 1, 0);
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const address = STACK_SEGMENT - 4;
      const expectedMemory = [
        {
          address,
          contents: bytes,
        },
      ];

      memory.store(address, bytes);

      assert.deepStrictEqual(memory.getMemoryDump(), expectedMemory);
    });

    it("should not store bytes in additional readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(), new Uint8Array(), 0, 0);
      memory.setupAdditionalReadOnlySegment(new Uint8Array(5));
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const address = STACK_SEGMENT;
      const expected = PageFault;

      const store = () => memory.store(address, bytes);

      assert.throws(store, expected);
    });

    it("should not store bytes in an inaccessible segment", () => {
      const memory = new Memory();
      const bytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);
      const address = 0;
      const expected = PageFault;

      const store = () => memory.store(address, bytes);

      assert.throws(store, expected);
    });
  });

  describe("Memory.load", () => {
    it("should load u8 from readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee, 0xdd, 0xcc]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff]);

      const bytes = memory.load(SEGMENT_SIZE, 1);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load u16 from readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee, 0xdd, 0xcc]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff, 0xee]);

      const bytes = memory.load(SEGMENT_SIZE, 2);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load u32 from readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee, 0xdd, 0xcc]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

      const bytes = memory.load(SEGMENT_SIZE, 4);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should load [0, 0, 0, 0] from readonly segment in case of empty memory", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array(4), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0, 0, 0, 0]);

      const bytes = memory.load(SEGMENT_SIZE, 4);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should fill missing values in memory with 0s", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0, 0]);

      const bytes = memory.load(SEGMENT_SIZE, 4);

      assert.deepStrictEqual(bytes, expectedBytes);
    });

    it("should not load bytes from an inaccessible segment", () => {
      const memory = new Memory();
      const address = 0;
      const expected = PageFault;

      const load = () => memory.load(address, 4);

      assert.throws(load, expected);
    });
  });

  describe("Memory.getPageDump", () => {
    it("should return dump of first page of readonly segment", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee, 0xdd, 0xcc]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

      const pageDump = memory.getPageDump(SEGMENT_SIZE / PAGE_SIZE);

      assert.deepStrictEqual(pageDump, expectedBytes);
    });

    it("should return null in case of inaccessible address", () => {
      const memory = new Memory();
      memory.setupMemory(new Uint8Array([0xff, 0xee, 0xdd, 0xcc]), new Uint8Array(), 0, 0);
      const expectedBytes = new Uint8Array([0xff, 0xee, 0xdd, 0xcc]);

      const pageDump = memory.getPageDump(0);

      assert.deepStrictEqual(pageDump, null);
    });
  });
});
