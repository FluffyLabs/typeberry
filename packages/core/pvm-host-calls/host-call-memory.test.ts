import { beforeEach, describe, it } from "node:test";
import { tryAsU64 } from "@typeberry/numbers";
import { MAX_MEMORY_INDEX, MEMORY_SIZE } from "@typeberry/pvm-interface";
import { Memory } from "@typeberry/pvm-interpreter";
import { OutOfBounds, PageFault } from "@typeberry/pvm-interpreter/memory/errors.js";
import { deepEqual, OK, Result } from "@typeberry/utils";
import { HostCallMemory } from "./host-call-memory.js";

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

      deepEqual(
        result,
        Result.error(PageFault.fromPageNumber(0, true), () => "Page fault: attempted to access reserved page 0"),
      );
    });

    it("should return OutOfBounds error when address + length exceeds MEMORY_SIZE", () => {
      const address = tryAsU64(MEMORY_SIZE - 2);
      const bytes = new Uint8Array([1, 2, 3]);

      const result = hostCallMemory.storeFrom(address, bytes);

      deepEqual(
        result,
        Result.error(
          new OutOfBounds(),
          () => "Memory access out of bounds: address 4294967294 + length 3 exceeds memory size",
        ),
      );
    });

    it("should wrap address when exceeds MAX_MEMORY_INDEX and throw", () => {
      const address = tryAsU64(MAX_MEMORY_INDEX + 1);
      const bytes = new Uint8Array([1, 2, 3]);

      const res = hostCallMemory.storeFrom(address, bytes);

      deepEqual(
        res,
        Result.error(PageFault.fromMemoryIndex(0, true), () => "Page fault: attempted to access reserved page 0"),
      );
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

      deepEqual(
        result,
        Result.error(PageFault.fromPageNumber(0, true), () => "Page fault: attempted to access reserved page 0"),
      );
    });

    it("should return OutOfBounds error when address + length exceeds MEMORY_SIZE", () => {
      const address = tryAsU64(MEMORY_SIZE - 2);
      const result = new Uint8Array(3);

      const res = hostCallMemory.loadInto(result, address);

      deepEqual(
        res,
        Result.error(
          new OutOfBounds(),
          () => "Memory access out of bounds: address 4294967294 + length 3 exceeds memory size",
        ),
      );
    });

    it("should wrap address when exceeds MAX_MEMORY_INDEX and throw", () => {
      const address = tryAsU64(MAX_MEMORY_INDEX + 1);
      const result = new Uint8Array([1, 2, 3]);

      const res = hostCallMemory.loadInto(result, address);

      deepEqual(
        res,
        Result.error(PageFault.fromMemoryIndex(0, true), () => "Page fault: attempted to access reserved page 0"),
      );
    });
  });
});
