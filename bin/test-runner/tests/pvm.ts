import assert from "node:assert";
import { type FromJson, json } from "@typeberry/json-parser";
import { Interpreter } from "@typeberry/pvm-interpreter";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { MemoryBuilder } from "@typeberry/pvm-interpreter/memory";
import { MAX_MEMORY_INDEX, PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts";
import { type MemoryIndex, tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index";
import { getPageNumber, getStartPageIndex } from "@typeberry/pvm-interpreter/memory/memory-utils";
import type { PageNumber } from "@typeberry/pvm-interpreter/memory/pages/page-utils";
import { Registers } from "@typeberry/pvm-interpreter/registers";
import { Status } from "@typeberry/pvm-interpreter/status";

namespace fromJson {
  export const uint8Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new Uint8Array(v);
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });

  export const bigUint64Array = json.fromAny((v) => {
    if (Array.isArray(v)) {
      return new BigUint64Array(v.map((x) => BigInt(x)));
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  });
}
class MemoryChunkItem {
  static fromJson: FromJson<MemoryChunkItem> = {
    address: "number",
    contents: fromJson.uint8Array,
  };
  address!: number;
  contents!: Uint8Array;
}

class PageMapItem {
  static fromJson: FromJson<PageMapItem> = {
    address: "number",
    length: "number",
    "is-writable": "boolean",
  };
  address!: number;
  length!: number;
  "is-writable": boolean;
}
export class PvmTest {
  static fromJson: FromJson<PvmTest> = {
    name: "string",
    "initial-regs": fromJson.bigUint64Array,
    "initial-pc": "number",
    "initial-page-map": json.array(PageMapItem.fromJson),
    "initial-memory": json.array(MemoryChunkItem.fromJson),
    "initial-gas": "number",
    program: fromJson.uint8Array,
    "expected-status": "string",
    "expected-regs": fromJson.bigUint64Array,
    "expected-pc": "number",
    "expected-memory": json.array(MemoryChunkItem.fromJson),
    "expected-gas": "number",
  };

  name!: string;
  "initial-regs": BigUint64Array;
  "initial-pc": number;
  "initial-page-map": PageMapItem[];
  "initial-memory": MemoryChunkItem[];
  "initial-gas": number;
  program!: Uint8Array;
  "expected-status": string;
  "expected-regs": BigUint64Array;
  "expected-pc": number;
  "expected-memory": MemoryChunkItem[];
  "expected-gas": number;
}

const getExpectedPage = (address: MemoryIndex, contents: Uint8Array, length: number) => {
  const pageStartIndex = getStartPageIndex(address);
  const rawPage = [...new Uint8Array(address - pageStartIndex), ...contents];
  return new Uint8Array([...rawPage, ...new Uint8Array(length - rawPage.length)]);
};

export async function runPvmTest(testContent: PvmTest) {
  const initialMemory = testContent["initial-memory"];
  const pageMap = testContent["initial-page-map"];
  const memoryBuilder = new MemoryBuilder();

  for (const page of pageMap) {
    const startPageIndex = tryAsMemoryIndex(page.address);
    const endPageIndex = tryAsMemoryIndex(startPageIndex + page.length);
    const isWriteable = page["is-writable"];

    if (isWriteable) {
      memoryBuilder.setWriteablePages(startPageIndex, endPageIndex, new Uint8Array(page.length));
    } else {
      memoryBuilder.setReadablePages(startPageIndex, endPageIndex, new Uint8Array(page.length));
    }
  }

  for (const memoryChunk of initialMemory) {
    const address = tryAsMemoryIndex(memoryChunk.address);
    memoryBuilder.setData(address, memoryChunk.contents);
  }
  const maxAddressFromPageMap = Math.max(0, ...pageMap.map((page) => page.address));
  const HEAP_START_PAGE = maxAddressFromPageMap === 0 ? 0 : maxAddressFromPageMap + PAGE_SIZE;
  const HEAP_END_PAGE = MAX_MEMORY_INDEX;
  const memory = memoryBuilder.finalize(tryAsSbrkIndex(HEAP_START_PAGE), tryAsSbrkIndex(HEAP_END_PAGE));
  const regs = new Registers();
  regs.copyFrom(testContent["initial-regs"]);

  const pvm = new Interpreter();

  const mapPvmStatus = (status: Status) => {
    if (status === Status.PANIC || status === Status.FAULT) {
      return "trap";
    }

    if (status === Status.OOG) {
      return "oog";
    }

    if (status === Status.HOST) {
      return "host";
    }

    return "halt";
  };

  pvm.reset(testContent.program, testContent["initial-pc"], testContent["initial-gas"] as Gas, regs, memory);
  pvm.runProgram();

  assert.strictEqual(pvm.getGas(), BigInt(testContent["expected-gas"]));
  assert.strictEqual(pvm.getPC(), testContent["expected-pc"]);
  assert.deepStrictEqual(pvm.getRegisters().getAllU64(), testContent["expected-regs"]);

  const testStatus = mapPvmStatus(pvm.getStatus());
  assert.strictEqual(testStatus, testContent["expected-status"]);

  const dirtyPages = memory.getDirtyPages();
  const checkedPages = new Set<PageNumber>();
  const expectedMemory = testContent["expected-memory"];

  for (const memoryChunk of expectedMemory) {
    const address = tryAsMemoryIndex(memoryChunk.address);
    const expectedPage = getExpectedPage(address, memoryChunk.contents, PAGE_SIZE);
    const pageNumber = getPageNumber(address);
    checkedPages.add(pageNumber);
    assert.deepStrictEqual(pvm.getMemoryPage(pageNumber), expectedPage);
  }

  const pageThatShouldBeEmpty = Array.from(dirtyPages).filter((pageNumber) => !checkedPages.has(pageNumber));

  for (const pageNumber of pageThatShouldBeEmpty) {
    const max = Math.max(...(pvm.getMemoryPage(pageNumber) || []));
    assert.deepStrictEqual(max, 0);
  }
}
