import assert from "node:assert";
import { test } from "node:test";
import { trieHasher } from "../blake2b.node";
import { Bytes, BytesBlob } from "../bytes";
import { InMemoryTrie, parseStateKey } from "./trie";

test("Trie", async () => {
	await test("Empty trie", () => {
		const trie = InMemoryTrie.empty(trieHasher);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"0000000000000000000000000000000000000000000000000000000000000000",
				32,
			),
		);
	});

	await test("Empty value", () => {
		const trie = InMemoryTrie.empty(trieHasher);

		trie.set(
			parseStateKey(
				"16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec",
			),
			BytesBlob.fromBytes([]),
		);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"17d7a1c738dfa055bc810110004585ca79be323586764e14179ee20e54376592",
				32,
			),
		);
	});

	await test("Should import some keys", () => {
		const trie = InMemoryTrie.empty(trieHasher);

		trie.set(
			parseStateKey(
				"645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9",
			),
			BytesBlob.fromBytes([0x72]),
		);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"75978696ab7bd70492c2abbecf26fd03eb2c41e0d83daf968f45c20f566b9a9b",
				32,
			),
		);
	});
});
