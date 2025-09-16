import { BytesBlob } from "@typeberry/bytes";
import { KeccakHasher } from "@typeberry/hash/keccak.js";
import { u32AsLeBytes } from "@typeberry/numbers";
import type { AccumulationOutput } from "@typeberry/state";
import { binaryMerkleization } from "@typeberry/state-merkleization";
import { getKeccakTrieHasher } from "@typeberry/trie/hasher.js";
import type { AccumulateRoot } from "./accumulate-state.js";

type AccumulateRootInput = {
  accumulationOutputLog: AccumulationOutput[];
};

export class AccumulateOutput {
  async transition({ accumulationOutputLog }: AccumulateRootInput): Promise<AccumulateRoot> {
    const rootHash = await getRootHash(accumulationOutputLog);
    return rootHash;
  }
}

/**
 * Returns a new root hash
 *
 * https://graypaper.fluffylabs.dev/#/38c4e62/3c9d013c9d01?v=0.7.0
 */
async function getRootHash(yieldedRoots: AccumulationOutput[]): Promise<AccumulateRoot> {
  const keccakHasher = await KeccakHasher.create();
  const trieHasher = getKeccakTrieHasher(keccakHasher);
  const yieldedRootsSortedByServiceId = yieldedRoots.sort((a, b) => a.serviceId - b.serviceId);
  const values = yieldedRootsSortedByServiceId.map(({ serviceId, output }) => {
    return BytesBlob.blobFromParts([u32AsLeBytes(serviceId), output.raw]);
  });

  return binaryMerkleization(values, trieHasher);
}
