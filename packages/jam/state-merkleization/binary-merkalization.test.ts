import { describe, it } from "node:test";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { KeccakHasher } from "@typeberry/hash/keccak.js";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher.js";
import { deepEqual } from "@typeberry/utils";
import { binaryMerkleization } from "./binary-merkalization.js";

describe("binaryMerkleization", () => {
  it("should correctly calculate merkle root for empty data", async () => {
    const keccakHasher = await KeccakHasher.create();
    const trieHasher = getKeccakTrieHasher(keccakHasher);
    const expectedResult = Bytes.parseBlob("0x0000000000000000000000000000000000000000000000000000000000000000");
    const input: BytesBlob[] = [];

    const result = binaryMerkleization(input, trieHasher);

    deepEqual(result, expectedResult);
  });

  it("should correctly calculate merkle root for not empty data", async () => {
    const keccakHasher = await KeccakHasher.create();
    const trieHasher = getKeccakTrieHasher(keccakHasher);
    const expectedResult = Bytes.parseBlob("0xa2a767f02df7e04b48f5cefc5c9fd9a1997ddf14e7e49ea9c9cf72a2c24be91e");
    const input = [
      "0x03f9883f0b27478648cd19b4f812f897a26976ecf312eac28508b4368d0c63ea949c7cb0",
      "0x549611b00200000002000000010000000000000000000000000000000000000000000000",
    ].map((x) => Bytes.parseBlob(x));

    const result = binaryMerkleization(input, trieHasher);

    deepEqual(result, expectedResult);
  });
});
