import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { tryAsU64 } from "@typeberry/numbers";
import { Memory } from "@typeberry/pvm-interpreter";
import { OutOfBounds, PageFault } from "@typeberry/pvm-interpreter/memory/errors";
import { MEMORY_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { OK, Result, deepEqual } from "@typeberry/utils";
import { HostCallMemory } from "./host-call-memory";

describe("HostCallMemory", () => {
  let memory: Memory;
  let hostCallMemory: HostCallMemory;

  beforeEach(() => {
    memory = new Memory();
    hostCallMemory = new HostCallMemory(memory);
  });

  describe("storeFrom", () => {
    it("should always allow 0-length bytes", () => {
      const bytes = new Uint8Array([]);
      const address = tryAsU64(2 ** 40);

      const result = hostCallMemory.storeFrom(address, bytes);

      deepEqual(result, Result.ok(OK));
    });

    it("should pass through the result of the underlying memory's storeFrom method", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const address = tryAsU64(0);

      const result = hostCallMemory.storeFrom(address, bytes);

      assert.strictEqual(result.isError, true);
      assert(result.error instanceof PageFault);
    });

    it("should return OutOfBounds error when address + length exceeds MEMORY_SIZE", () => {
      const address = tryAsU64(MEMORY_SIZE - 2);
      const bytes = new Uint8Array([1, 2, 3]);

      const result = hostCallMemory.storeFrom(address, bytes);

      assert.strictEqual(result.isError, true);
      if (result.isError) {
        assert(result.error instanceof OutOfBounds);
      }
    });

    it("should throw when address exceeds MAX_MEMORY_INDEX", () => {
      const address = tryAsU64(MEMORY_SIZE);
      const bytes = new Uint8Array([1, 2, 3]);

      assert.deepEqual(hostCallMemory.storeFrom(address, bytes), Result.error(new OutOfBounds()));
    });
  });

  describe("loadInto", () => {
    it("should always allow 0-length bytes", () => {
      const bytes = new Uint8Array([]);
      const address = tryAsU64(2 ** 40);

      const result = hostCallMemory.loadInto(bytes, address);

      deepEqual(result, Result.ok(OK));
    });

    it("should pass through the result of the underlying memory's loadInto method", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const address = tryAsU64(0);

      const result = hostCallMemory.loadInto(bytes, address);

      assert.strictEqual(result.isError, true);
      assert(result.error instanceof PageFault);
    });

    it("should return OutOfBounds error when address + length exceeds MEMORY_SIZE", () => {
      const address = tryAsU64(MEMORY_SIZE - 2);
      const result = new Uint8Array(3);

      const loadResult = hostCallMemory.loadInto(result, address);

      assert.strictEqual(loadResult.isError, true);
      if (loadResult.isError) {
        assert(loadResult.error instanceof OutOfBounds);
      }
    });

    it("should throw when address exceeds MAX_MEMORY_INDEX", () => {
      const address = tryAsU64(MEMORY_SIZE);
      const result = new Uint8Array([1, 2, 3]);

      assert.deepEqual(hostCallMemory.loadInto(result, address), Result.error(new OutOfBounds()));
    });
  });

  describe("getMemory", () => {
    it("should return the underlying memory instance", () => {
      const result = hostCallMemory.getMemory();

      assert.strictEqual(result, memory);
    });
  });
});
