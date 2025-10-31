import assert from "node:assert";
import { it } from "node:test";
import { Bytes } from "@typeberry/bytes";
import { Blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { fisherYatesShuffle } from "@typeberry/shuffling";

const bytes32NoPrefix = <T extends Bytes<32>>() =>
  json.fromString<T>((v) => Bytes.parseBytesNoPrefix(v, 32).asOpaque());

class ShufflingTest {
  static fromJson: FromJson<ShufflingTest> = {
    input: "number",
    entropy: bytes32NoPrefix(),
    output: ["array", "number"],
  };

  input!: number;
  entropy!: Bytes<32>;
  output!: number[];
}

export const shufflingTestsFromJson = json.array(ShufflingTest.fromJson);

export async function runShufflingTests(testContents: ShufflingTest[]) {
  const blake2b = await Blake2b.createHasher();
  for (const testContent of testContents) {
    it(`should correctly shuffle input of length ${testContent.input}`, () => {
      const input = Array.from({ length: testContent.input }, (_, i) => i);

      const result = fisherYatesShuffle(blake2b, input, testContent.entropy);

      assert.deepStrictEqual(result, testContent.output);
    });
  }
}
