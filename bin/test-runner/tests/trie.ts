import assert from "node:assert";
import { test } from "node:test";

import { Bytes, BytesBlob } from "@typeberry/bytes";
import { InMemoryTrie, type StateKey, type TrieHash } from "@typeberry/trie";
import { blake2bTrieHasher } from "@typeberry/trie/blake2b.node";
import type { FromJson } from "../json-parser";

export class TrieTest {
  static fromJson: FromJson<TrieTest> = {
    input: [
      "object",
      (input: unknown, context?: string): Map<StateKey, BytesBlob> => {
        if (input === null) {
          throw new Error(`[${context}] Unexpected 'null'`);
        }
        if (typeof input !== "object") {
          throw new Error(`[${context}] Expected an object.`);
        }

        const output: Map<StateKey, BytesBlob> = new Map();
        for (const [k, v] of Object.entries(input)) {
          const key = Bytes.parseBytesNoPrefix(k, 32) as StateKey;
          const value = BytesBlob.parseBlobNoPrefix(v);
          output.set(key, value);
        }

        return output;
      },
    ],
    output: ["string", (v: string) => Bytes.parseBytesNoPrefix(v, 32) as TrieHash],
  };
  input!: Map<StateKey, BytesBlob>;
  output!: TrieHash;
}

export type TrieTestSuite = [TrieTest];
export const trieTestSuiteFromJson: FromJson<TrieTestSuite> = ["array", TrieTest.fromJson];

export async function runTrieTest(testContent: TrieTestSuite) {
  for (const [id, testData] of testContent.entries()) {
    await test(`Trie test ${id}`, () => {
      const trie = InMemoryTrie.empty(blake2bTrieHasher);

      for (const [key, value] of testData.input.entries()) {
        trie.set(key, value);
      }

      assert.deepStrictEqual(testData.output, trie.getRoot());
    });
  }
}
