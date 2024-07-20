import assert from "node:assert";
import { test } from "node:test";
import { trieHasher } from "../blake2b.node";
import { Bytes, BytesBlob } from "../bytes";
import { InMemoryTrie, parseStateKey } from "./trie";

test("Trie", () => {
	test("Should import some keys", () => {
		const trie = InMemoryTrie.empty(trieHasher);

		trie.set(
			parseStateKey(
				"645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9",
			),
			BytesBlob.fromBytes([72]),
		);

		assert.strictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"75978696ab7bd70492c2abbecf26fd03eb2c41e0d83daf968f45c20f566b9a9b",
				32,
			),
		);
	});
});
