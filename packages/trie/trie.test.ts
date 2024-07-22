import assert from "node:assert";
import { test } from "node:test";
import { blake2bTrieHasher } from "../blake2b.node";
import { Bytes, BytesBlob } from "../bytes";
import { InMemoryTrie, LeafNode, parseStateKey } from "./trie";

test("Trie", async () => {
	await test("Empty trie", () => {
		const trie = InMemoryTrie.empty(blake2bTrieHasher);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"0000000000000000000000000000000000000000000000000000000000000000",
				32,
			),
		);
	});

	await test("Leaf Node", () => {
			const key = parseStateKey(
				"16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec",
			);
			const value = BytesBlob.parseBlob("0x4227b4a465084852cd87d8f23bec0db6fa7766b9685ab5e095ef9cda9e15e49dff");
			const valueHash = blake2bTrieHasher.hashConcat(value.buffer);
			const node = LeafNode.fromValue(key, value, valueHash)

			assert.deepStrictEqual(
				node.getKey(),
				Bytes.parseBytes(
					"0x16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8",
					31
				)
			);
			assert.deepStrictEqual(node.getValueLength(), 0);
			assert.deepStrictEqual(node.getValue().buffer, Bytes.zero(0).raw);
			assert.deepStrictEqual(node.getValueHash(), valueHash);
	});

	await test("Empty value", () => {
		const trie = InMemoryTrie.empty(blake2bTrieHasher);

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
		const trie = InMemoryTrie.empty(blake2bTrieHasher);

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

	await test("Non embedded leaf", () => {
const trie = InMemoryTrie.empty(blake2bTrieHasher);

		trie.set(
			parseStateKey(
				"3dbc5f775f6156957139100c343bb5ae6589af7398db694ab6c60630a9ed0fcd",
			),
			BytesBlob.parseBlob("0x4227b4a465084852cd87d8f23bec0db6fa7766b9685ab5e095ef9cda9e15e49d"),
		);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"9ea1799e255f9b5edb960cf6640aa42ec2fac24a199be8155853ddcce9b896c4",
				32,
			),
		);
	});

	await test("More complicated trie", () => {
		const trie = InMemoryTrie.empty(blake2bTrieHasher);

		trie.set(
			parseStateKey(
				"f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"
			),
			BytesBlob.parseBlob("0x22c62f84ee5775d1e75ba6519f6dfae571eb1888768f2a203281579656b6a29097f7c7e2cf44e38da9a541d9b4c773db8b71e1d3"),
		);
		trie.set(
			parseStateKey(
				"f3a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"
			),
			BytesBlob.parseBlob("0x44d0b26211d9d4a44e375207")
		);

		assert.deepStrictEqual(
			trie.getRoot(),
			Bytes.parseBytesNoPrefix(
				"b9c99f66e5784879a178795b63ae178f8a49ee113652a122cd4b3b2a321418c1",
				32,
			),
		);
	});

	await test("Test vector 9", () => {
		const vector = {
			"input": {
				"d7f99b746f23411983df92806725af8e5cb66eba9f200737accae4a1ab7f47b9": "24232437f5b3f2380ba9089bdbc45efaffbe386602cb1ecc2c17f1d0",
				"59ee947b94bcc05634d95efb474742f6cd6531766e44670ec987270a6b5a4211": "72fdb0c99cf47feb85b2dad01ee163139ee6d34a8d893029a200aff76f4be5930b9000a1bbb2dc2b6c79f8f3c19906c94a3472349817af21181c3eef6b",
				"a3dc3bed1b0727caf428961bed11c9998ae2476d8a97fad203171b628363d9a2": "8a0dafa9d6ae6177",
				"15207c233b055f921701fc62b41a440d01dfa488016a97cc653a84afb5f94fd5": "157b6c821169dacabcf26690df",
				"b05ff8a05bb23c0d7b177d47ce466ee58fd55c6a0351a3040cf3cbf5225aab19": "6a208734106f38b73880684b"
			},
			"output": "55634c70b9dca56f2f40b343f750a5c9744798370cbf3f669e29ebe0b8d64ceb"
		};
		debugger;
		runTestVector(vector);
	});

	function runTestVector(vector: { input: { [key: string]: string }, output: string }) {
		const trie = InMemoryTrie.empty(blake2bTrieHasher);

		for (const [key, val] of Object.entries(vector.input)) {
				const stateKey = parseStateKey(key);
				const value = BytesBlob.parseBlobNoPrefix(val);
				trie.set(stateKey, value);
		}

		const expected = Bytes.parseBytesNoPrefix(vector.output, 32);
		assert.deepStrictEqual(trie.getRoot(), expected);
	}
});

