import assert from "node:assert";
import { MemoryBuilder } from "@typeberry/pvm/memory";
import { PAGE_SIZE } from "@typeberry/pvm/memory/memory-consts";
import { createMemoryIndex } from "@typeberry/pvm/memory/memory-index";
import { Pvm, type RegistersArray } from "@typeberry/pvm/pvm";
import type { FromJson } from "./json-parser";

const uint8ArrayFromJson: ["object", (v: unknown) => Uint8Array] = [
  "object",
  (v: unknown) => {
    if (Array.isArray(v)) {
      return new Uint8Array(v);
    }

    throw new Error(`Expected an array, got ${typeof v} instead.`);
  },
];

class MemoryChunkItem {
  static fromJson: FromJson<MemoryChunkItem> = {
    address: "number",
    contents: uint8ArrayFromJson,
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
    "initial-regs": ["array", "number"],
    "initial-pc": "number",
    "initial-page-map": ["array", PageMapItem.fromJson],
    "initial-memory": ["array", MemoryChunkItem.fromJson],
    "initial-gas": "number",
    program: uint8ArrayFromJson,
    "expected-status": "string",
    "expected-regs": ["array", "number"],
    "expected-pc": "number",
    "expected-memory": ["array", MemoryChunkItem.fromJson],
    "expected-gas": "number",
  };

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

export async function runPvmTest(testContent: PvmTest) {
  const initialMemory = testContent["initial-memory"];
  const pageMap = testContent["initial-page-map"];
  const memoryBuilder = new MemoryBuilder();

  for (const page of pageMap) {
    const startPageIndex = createMemoryIndex(page.address);
    const endPageIndex = createMemoryIndex(startPageIndex + page.length);
    const isWriteable = page["is-writable"];

    const memoryChunksOnThisPage = initialMemory.filter(
      ({ address }) => address >= startPageIndex && address < endPageIndex,
    );

    if (memoryChunksOnThisPage.length === 0) {
      if (isWriteable) {
        memoryBuilder.setWriteable(startPageIndex, endPageIndex, new Uint8Array());
      } else {
        memoryBuilder.setReadable(startPageIndex, endPageIndex, new Uint8Array());
      }
    }

    for (const memoryChunk of memoryChunksOnThisPage) {
      const address = createMemoryIndex(memoryChunk.address);
      let contents: number[] = [];

      if (address > startPageIndex) {
        contents = contents.concat(...new Uint8Array(address - startPageIndex));
      }

      contents = contents.concat(...memoryChunk.contents);

      if (isWriteable) {
        memoryBuilder.setWriteable(startPageIndex, endPageIndex, new Uint8Array(contents));
      } else {
        memoryBuilder.setReadable(startPageIndex, endPageIndex, new Uint8Array(contents));
      }
    }
  }

  const memory = memoryBuilder.finalize(createMemoryIndex(16 * PAGE_SIZE), createMemoryIndex(32 * PAGE_SIZE));

  const pvm = new Pvm(testContent.program, {
    gas: testContent["initial-gas"],
    memory: memory,
    pc: testContent["initial-pc"],
    regs: testContent["initial-regs"],
  });

  pvm.runProgram();

  assert.strictEqual(pvm.getGas(), testContent["expected-gas"]);
  assert.strictEqual(pvm.getPC(), testContent["expected-pc"]);
  // assert.deepStrictEqual(pvm.getMemory(), testContent["expected-memory"]);
  assert.deepStrictEqual(Array.from(pvm.getRegisters()), testContent["expected-regs"]);
  const pvmStatus = pvm.getStatus();
  const testStatus = pvmStatus <= 1 ? "halt" : "trap";
  assert.strictEqual(testStatus, testContent["expected-status"]);
}
