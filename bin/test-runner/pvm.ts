import assert from "node:assert";
import { Pvm, type RegistersArray } from "@typeberry/pvm/pvm";
import type { FromJson } from "./json-parser";

type Status = "trap";
class MemoryChunkItem {
  static fromJson: FromJson<MemoryChunkItem> = {
    address: "number",
    contents: [
      "object",
      (v: unknown) => {
        if (Array.isArray(v)) {
          return new Uint8Array(v);
        }

        return new Uint8Array();
      },
    ],
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
    program: [
      "object",
      (v: unknown) => {
        if (Array.isArray(v)) {
          return new Uint8Array(v);
        }

        return new Uint8Array();
      },
    ],
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
  "expected-status": Status;
  "expected-regs": RegistersArray;
  "expected-pc": number;
  "expected-memory": MemoryChunkItem[];
  "expected-gas": number;
}

export async function runPvmTest(testContent: PvmTest) {
  const pvm = new Pvm(testContent.program, {
    gas: testContent["initial-gas"],
    memory: testContent["initial-memory"],
    pageMap: testContent["initial-page-map"],
    pc: testContent["initial-pc"],
    regs: testContent["initial-regs"],
  });

  pvm.runProgram();
  const state = pvm.getState();

  assert.strictEqual(state.gas, testContent["expected-gas"]);
  assert.strictEqual(state.pc, testContent["expected-pc"]);
  assert.deepStrictEqual(state.memory, testContent["expected-memory"]);
  assert.deepStrictEqual(state.regs, testContent["expected-regs"]);
  assert.strictEqual(state.status, testContent["expected-status"]);
}
