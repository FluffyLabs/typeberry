import blake2b from "blake2b";
import { Bytes } from "./bytes";
import type { TrieHash, TrieHasher } from "./trie/trie";

export const trieHasher: TrieHasher = {
	hashConcat(n: DataView, rest?: DataView[]): TrieHash {
		const hasher = blake2b(512);
		hasher?.update(n);
		for (const v of rest ?? []) {
			hasher?.update(v);
		}
		const out = Bytes.zero(32);
		hasher?.digest(out);
		return out as TrieHash;
	},
};
