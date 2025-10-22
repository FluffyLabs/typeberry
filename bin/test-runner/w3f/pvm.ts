import assert from "node:assert";
import { fromJson } from "@typeberry/block-json";
import { type FromJson, json } from "@typeberry/json-parser";
import { MAX_MEMORY_INDEX, Status, tryAsGas } from "@typeberry/pvm-interface";
import { Interpreter } from "@typeberry/pvm-interpreter";
import { MemoryBuilder } from "@typeberry/pvm-interpreter/memory/index.js";
import { PAGE_SIZE } from "@typeberry/pvm-interpreter/memory/memory-consts.js";
import { tryAsMemoryIndex, tryAsSbrkIndex } from "@typeberry/pvm-interpreter/memory/memory-index.js";
import { getPageNumber } from "@typeberry/pvm-interpreter/memory/memory-utils.js";
import { type PageNumber, tryAsPageNumber } from "@typeberry/pvm-interpreter/memory/pages/page-utils.js";
import { Registers } from "@typeberry/pvm-interpreter/registers.js";
import { safeAllocUint8Array } from "@typeberry/utils";

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
    "expected-page-fault-address": json.optional("number"),
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
  "expected-page-fault-address"?: number;
}

// TODO [MaSo] Test also on Ananas 🍍
export async function runPvmTest(testContent: PvmTest) {
  const initialMemory = testContent["initial-memory"];
  const pageMap = testContent["initial-page-map"];
  const memoryBuilder = new MemoryBuilder();

  for (const page of pageMap) {
    const startPageIndex = tryAsMemoryIndex(page.address);
    const endPageIndex = tryAsMemoryIndex(startPageIndex + page.length);
    const isWriteable = page["is-writable"];

    if (isWriteable) {
      memoryBuilder.setWriteablePages(startPageIndex, endPageIndex, safeAllocUint8Array(page.length));
    } else {
      memoryBuilder.setReadablePages(startPageIndex, endPageIndex, safeAllocUint8Array(page.length));
    }
  }

  for (const memoryChunk of initialMemory) {
    const address = tryAsMemoryIndex(memoryChunk.address);
    memoryBuilder.setData(address, memoryChunk.contents);
  }
  const maxAddressFromPageMap = Math.max(...pageMap.map((page) => page.address + page.length));
  const hasMemoryLayout = maxAddressFromPageMap >= 0;
  const HEAP_START_PAGE = hasMemoryLayout ? maxAddressFromPageMap + PAGE_SIZE : 0;
  const HEAP_END_PAGE = MAX_MEMORY_INDEX;
  const memory = memoryBuilder.finalize(tryAsMemoryIndex(HEAP_START_PAGE), tryAsSbrkIndex(HEAP_END_PAGE));
  const regs = new Registers();
  regs.copyFrom(testContent["initial-regs"]);

  const pvm = new Interpreter();

  const mapPvmStatus = (status: Status) => {
    if (status === Status.FAULT) {
      return "page-fault";
    }

    if (status === Status.PANIC) {
      return "panic";
    }

    if (status === Status.OOG) {
      return "oog";
    }

    if (status === Status.HOST) {
      return "host";
    }

    return "halt";
  };

  pvm.resetGeneric(testContent.program, testContent["initial-pc"], tryAsGas(testContent["initial-gas"]), regs, memory);
  pvm.runProgram();

  assert.strictEqual(pvm.getGas().get(), BigInt(testContent["expected-gas"]));
  assert.strictEqual(pvm.getPC(), testContent["expected-pc"]);
  assert.deepStrictEqual(pvm.getRegisters().getAllU64(), testContent["expected-regs"]);

  const testStatus = mapPvmStatus(pvm.getStatus());
  const exitParam = pvm.getExitParam();
  assert.strictEqual(testStatus, testContent["expected-status"]);
  assert.strictEqual(exitParam, testContent["expected-page-fault-address"] ?? null);

  const dirtyPages = memory.getDirtyPages();
  const checkedPages = new Set<PageNumber>();
  const expectedMemory = testContent["expected-memory"];

  const expectedMemoryByPageNumber = expectedMemory.reduce(
    (acc, memoryChunk) => {
      const memoryAddress = tryAsMemoryIndex(memoryChunk.address);
      const pageNumber = getPageNumber(memoryAddress);
      const chunksOnPage = acc[pageNumber] ?? [];
      chunksOnPage.push(memoryChunk);
      acc[pageNumber] = chunksOnPage;
      return acc;
    },
    {} as { [key: number]: MemoryChunkItem[] },
  );

  for (const [pageNumberAsString, memoryChunks] of Object.entries(expectedMemoryByPageNumber)) {
    const pageNumber = tryAsPageNumber(Number(pageNumberAsString));
    const expectedPage = safeAllocUint8Array(PAGE_SIZE);
    for (const memoryChunk of memoryChunks) {
      const pageIndex = memoryChunk.address % PAGE_SIZE;
      expectedPage.set(memoryChunk.contents, pageIndex);
    }
    checkedPages.add(pageNumber);
    assert.deepStrictEqual(pvm.getMemoryPage(pageNumber), expectedPage);
  }

  const pageThatShouldBeEmpty = Array.from(dirtyPages).filter((pageNumber) => !checkedPages.has(pageNumber));

  for (const pageNumber of pageThatShouldBeEmpty) {
    const memoryPage = pvm.getMemoryPage(pageNumber);
    const max = memoryPage !== null ? Math.max(...memoryPage) : 0;
    assert.deepStrictEqual(max, 0);
  }
}
