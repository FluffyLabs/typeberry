import assert from "node:assert";
import { MemoryBuilder } from "@typeberry/pvm/memory";
import { PAGE_SIZE } from "@typeberry/pvm/memory/memory-consts";
import { type MemoryIndex, createMemoryIndex } from "@typeberry/pvm/memory/memory-index";
import { getPageNumber, getStartPageIndex } from "@typeberry/pvm/memory/memory-utils";
import type { PageNumber } from "@typeberry/pvm/memory/pages/page-utils";
import { Pvm, type RegistersArray } from "@typeberry/pvm/pvm";
import { ANY, ARRAY, BOOLEAN, type FromJson, NUMBER, OBJECT, STRING } from "../json-parser";

const uint8ArrayFromJson = ANY((v: unknown) => {
  if (Array.isArray(v)) {
    return new Uint8Array(v);
  }

  throw new Error(`Expected an array, got ${typeof v} instead.`);
});

class MemoryChunkItem {
  static fromJson: FromJson<MemoryChunkItem> = OBJECT({
    address: NUMBER(),
    contents: uint8ArrayFromJson,
  });
  address!: number;
  contents!: Uint8Array;
}

class PageMapItem {
  static fromJson: FromJson<PageMapItem> = OBJECT({
    address: NUMBER(),
    length: NUMBER(),
    "is-writable": BOOLEAN(),
  });
  address!: number;
  length!: number;
  "is-writable": boolean;
}
export class PvmTest {
  static fromJson: FromJson<PvmTest> = OBJECT({
    name: STRING(),
    "initial-regs": ARRAY(NUMBER()),
    "initial-pc": NUMBER(),
    "initial-page-map": ARRAY(PageMapItem.fromJson),
    "initial-memory": ARRAY(MemoryChunkItem.fromJson),
    "initial-gas": NUMBER(),
    program: uint8ArrayFromJson,
    "expected-status": STRING(),
    "expected-regs": ARRAY(NUMBER()),
    "expected-pc": NUMBER(),
    "expected-memory": ARRAY(MemoryChunkItem.fromJson),
    "expected-gas": NUMBER(),
  });

  name!: string;
  "initial-regs": RegistersArray;
  "initial-pc": number;
  "initial-page-map": PageMapItem[];
  "initial-memory": MemoryChunkItem[];
  "initial-gas": number;
  program!: Uint8Array;
  "expected-status": string;
  "expected-regs": RegistersArray;
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
    const startPageIndex = createMemoryIndex(page.address);
    const endPageIndex = createMemoryIndex(startPageIndex + page.length);
    const isWriteable = page["is-writable"];

    if (isWriteable) {
      memoryBuilder.setWriteable(startPageIndex, endPageIndex, new Uint8Array(page.length));
    } else {
      memoryBuilder.setReadable(startPageIndex, endPageIndex, new Uint8Array(page.length));
    }
  }

  for (const memoryChunk of initialMemory) {
    const address = createMemoryIndex(memoryChunk.address);
    memoryBuilder.setData(address, memoryChunk.contents);
  }

  /**
   * The values of HEAP_START_PAGE and HEAP_END_PAGE are not important.
   * For now it is enough that the heap is behind the space used by tests.
   */
  const HEAP_START_PAGE = 16;
  const HEAP_END_PAGE = 32;
  const memory = memoryBuilder.finalize(createMemoryIndex(HEAP_START_PAGE), createMemoryIndex(HEAP_END_PAGE));

  const pvm = new Pvm(testContent.program, {
    gas: testContent["initial-gas"],
    memory: memory,
    pc: testContent["initial-pc"],
    regs: testContent["initial-regs"],
  });

  pvm.runProgram();

  assert.strictEqual(pvm.getGas(), testContent["expected-gas"]);
  assert.strictEqual(pvm.getPC(), testContent["expected-pc"]);
  assert.deepStrictEqual(Array.from(pvm.getRegisters()), testContent["expected-regs"]);
  const pvmStatus = pvm.getStatus();
  const testStatus = pvmStatus <= 1 ? "halt" : "trap";
  assert.strictEqual(testStatus, testContent["expected-status"]);

  const dirtyPages = memory.getDirtyPages();
  const checkedPages = new Set<PageNumber>();
  const expectedMemory = testContent["expected-memory"];
  for (const memoryChunk of expectedMemory) {
    const address = createMemoryIndex(memoryChunk.address);
    const expectedPage = getExpectedPage(address, memoryChunk.contents, PAGE_SIZE);
    const pageNumber = getPageNumber(address);
    checkedPages.add(pageNumber);
    assert.deepStrictEqual(pvm.getMemoryPage(pageNumber), expectedPage);
  }

  const emptyPage = new Uint8Array(PAGE_SIZE);
  const pageThatShouldBeEmpty = Array.from(dirtyPages).filter((pageNumber) => !checkedPages.has(pageNumber));

  for (const pageNumber of pageThatShouldBeEmpty) {
    assert.deepStrictEqual(pvm.getMemoryPage(pageNumber), emptyPage);
  }
}
