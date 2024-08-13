import assert from "node:assert";
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

function getMemory(pageMap: PageMapItem[], memory: MemoryChunkItem[], isWritable: boolean) {
  const heap = pageMap.filter((x) => x["is-writable"] === isWritable)[0];
  if (heap) {
    const address = heap.address;
    const data = new Uint8Array(heap.length);
    const chunk = memory.find((x) => x.address === address);
    if (chunk) {
      data.set(chunk.contents, chunk.address - address);
    }
    return data;
  }
  return new Uint8Array();
}

export async function runPvmTest(testContent: PvmTest) {
  const memory = testContent["initial-memory"];
  const pageMap = testContent["initial-page-map"];

  const pvm = new Pvm(testContent.program, {
    gas: testContent["initial-gas"],
    pc: testContent["initial-pc"],
    regs: testContent["initial-regs"],
  });

  const heap = getMemory(pageMap, memory, true);
  const readOnly = getMemory(pageMap, memory, false);
  pvm.setMemory(readOnly, heap, 0, 0);
  pvm.runProgram();

  assert.strictEqual(pvm.getGas(), testContent["expected-gas"]);
  assert.strictEqual(pvm.getPC(), testContent["expected-pc"]);
  assert.deepStrictEqual(pvm.getMemory(), testContent["expected-memory"]);
  assert.deepStrictEqual(Array.from(pvm.getRegisters()), testContent["expected-regs"]);
  const pvmStatus = pvm.getStatus();
  const testStatus = pvmStatus <= 1 ? "halt" : "trap";
  assert.strictEqual(testStatus, testContent["expected-status"]);
}
