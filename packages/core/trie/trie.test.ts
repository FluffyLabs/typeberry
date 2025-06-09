import assert from "node:assert";
import { describe, it } from "node:test";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { blake2bTrieHasher } from "./hasher";
import { LeafNode, parseInputKey } from "./nodes";
import { InMemoryTrie } from "./trie";

describe("Trie", async () => {
  it("Empty trie", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    assert.deepStrictEqual(
      trie.getRootHash(),
      Bytes.parseBytesNoPrefix("0000000000000000000000000000000000000000000000000000000000000000", 32),
    );
  });

  it("Leaf Node", () => {
    const key = parseInputKey("16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec");
    const value = BytesBlob.parseBlob("0x4227b4a465084852cd87d8f23bec0db6fa7766b9685ab5e095ef9cda9e15e49dff");
    const valueHash = () => blake2bTrieHasher.hashConcat(value.raw);
    const node = LeafNode.fromValue(key, value, valueHash);

    assert.deepStrictEqual(
      node.getKey(),
      Bytes.parseBytes("0x16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8", 31),
    );
    assert.deepStrictEqual(node.getValueLength(), 0);
    assert.deepStrictEqual(node.getValue().raw, Bytes.zero(0).raw);
    assert.deepStrictEqual(node.getValueHash(), valueHash);
  });

  it("Empty value", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    trie.set(
      parseInputKey("16c72e0c2e0b78157e3a116d86d90461a199e439325317aea160b30347adb8ec"),
      BytesBlob.blobFromNumbers([]),
    );

    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      Bytes.parseBytesNoPrefix("99ecb1509d2cbc16bab389714e5933932977e742472fcd9277d67f45699e076a", 32).toString(),
    );
  });

  it("Should import some keys", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    trie.set(
      parseInputKey("645eece27fdce6fd3852790131a50dc5b2dd655a855421b88700e6eb43279ad9"),
      BytesBlob.blobFromNumbers([0x72]),
    );

    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      Bytes.parseBytesNoPrefix("e9a89ab2f10d45a46d47127110e8353d6443b635b08e989a743c27bb82740d7d", 32).toString(),
    );
  });

  it("Non embedded leaf", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    trie.set(
      parseInputKey("3dbc5f775f6156957139100c343bb5ae6589af7398db694ab6c60630a9ed0fcd"),
      BytesBlob.parseBlob("0x4227b4a465084852cd87d8f23bec0db6fa7766b9685ab5e095ef9cda9e15e49d"),
    );

    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      Bytes.parseBytesNoPrefix("5fd68f074c914741601931d64c6c772c18ab8a4cd0cd3a4fff0611a5d97ecc94", 32).toString(),
    );
  });

  it("More complicated trie", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    trie.set(
      parseInputKey("f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob(
        "0x22c62f84ee5775d1e75ba6519f6dfae571eb1888768f2a203281579656b6a29097f7c7e2cf44e38da9a541d9b4c773db8b71e1d3",
      ),
    );
    trie.set(
      parseInputKey("f3a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob("0x44d0b26211d9d4a44e375207"),
    );

    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      Bytes.parseBytesNoPrefix("fb4bc560e0c314b09a29fc3f83a7f063ec118ff3fc1fba4430fcc0fbea09a207", 32).toString(),
    );
  });

  it("Move leaf from left to right branch", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    // left value
    trie.set(
      parseInputKey("f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob("0x23"),
    );

    // right value
    trie.set(
      parseInputKey("f1a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob("0x1234"),
    );

    // now insert another leaf, which causes `0xf2..` to move to the right.
    trie.set(
      parseInputKey("f0a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob("0x1234"),
    );

    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      "0xf07003b9d508b5b017960d069ada7893146c3425be6293b7ac3d4a9709d33b47",
    );
  });

  it("Replace leaf value", () => {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);
    const insert = {
      f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3: "0x23",
      f1a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3: "0x1234",
      f0a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3: "0x1234",
    };
    for (const [k, v] of Object.entries(insert)) {
      trie.set(parseInputKey(k), BytesBlob.parseBlob(v));
    }
    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      "0xf07003b9d508b5b017960d069ada7893146c3425be6293b7ac3d4a9709d33b47",
    );

    // now set the same key again
    trie.set(
      parseInputKey("f2a9fcaf8ae0ff770b0908ebdee1daf8457c0ef5e1106c89ad364236333c5fb3"),
      BytesBlob.parseBlob("0x1234"),
    );
    assert.deepStrictEqual(
      trie.getRootHash().toString(),
      "0xd6349d4e62a4288ba3d80b94421f2933b13f6f882b2c69a90508aa92ff88343f",
    );
  });

  const testVector9 = {
    d7f99b746f23411983df92806725af8e5cb66eba9f200737accae4a1ab7f47b9:
      "24232437f5b3f2380ba9089bdbc45efaffbe386602cb1ecc2c17f1d0",
    "59ee947b94bcc05634d95efb474742f6cd6531766e44670ec987270a6b5a4211":
      "72fdb0c99cf47feb85b2dad01ee163139ee6d34a8d893029a200aff76f4be5930b9000a1bbb2dc2b6c79f8f3c19906c94a3472349817af21181c3eef6b",
    a3dc3bed1b0727caf428961bed11c9998ae2476d8a97fad203171b628363d9a2: "8a0dafa9d6ae6177",
    "15207c233b055f921701fc62b41a440d01dfa488016a97cc653a84afb5f94fd5": "157b6c821169dacabcf26690df",
    b05ff8a05bb23c0d7b177d47ce466ee58fd55c6a0351a3040cf3cbf5225aab19: "6a208734106f38b73880684b",
  };

  it("should return all leaf nodes", () => {
    const data = { ...testVector9 };

    // construct the trie
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    for (const [key, val] of Object.entries(data)) {
      const stateKey = parseInputKey(key);
      const value = BytesBlob.parseBlobNoPrefix(val);
      trie.set(stateKey, value);
    }

    // when
    const leaves = Array.from(trie.nodes.leaves());

    assert.deepStrictEqual(
      leaves.map((val) => `${val.getKey()}: ${val.node}`),
      [
        "0xb301f7d9e40ffed69a3056d5c93563c9c8adf52267ad577983db613b3dbb9aad: 0x9cd7f99b746f23411983df92806725af8e5cb66eba9f200737accae4a1ab7f4724232437f5b3f2380ba9089bdbc45efaffbe386602cb1ecc2c17f1d000000000",
        "0xf0fe9027093e50ec39cdf719f542063ced28ddae45f2454be9f36a535e18e2f7: 0xc059ee947b94bcc05634d95efb474742f6cd6531766e44670ec987270a6b5a42a7f2482020023b85b4009884a31aea08f03b4bbdb5efd5e6ff1d63f1a86aaa53",
        "0x31762e449816fa031ac9fe96dc59b1bc213b84c72bccaef634421dbbc1c7b3e4: 0x88a3dc3bed1b0727caf428961bed11c9998ae2476d8a97fad203171b628363d98a0dafa9d6ae6177000000000000000000000000000000000000000000000000",
        "0xc07dd46f7b8a644e5d276826295696ec3cfa12dc2985f026fc975807d66b6a3e: 0x8d15207c233b055f921701fc62b41a440d01dfa488016a97cc653a84afb5f94f157b6c821169dacabcf26690df00000000000000000000000000000000000000",
        "0x7c1f4426a4001d57d8d46e21bacd8846be46f124750127d418c00b5510b0b883: 0x8cb05ff8a05bb23c0d7b177d47ce466ee58fd55c6a0351a3040cf3cbf5225aab6a208734106f38b73880684b0000000000000000000000000000000000000000",
      ],
    );
  });

  it("should create trie from leaf nodes", () => {
    const data = { ...testVector9 };

    // construct the trie manually
    const trie = InMemoryTrie.empty(blake2bTrieHasher);
    for (const [key, val] of Object.entries(data)) {
      const stateKey = parseInputKey(key);
      const value = BytesBlob.parseBlobNoPrefix(val);
      trie.set(stateKey, value);
    }

    // when
    const leaves = Array.from(trie.nodes.leaves());
    const actual = InMemoryTrie.fromLeaves(
      blake2bTrieHasher,
      leaves,
    );

    assert.deepStrictEqual(actual.getRootHash(), trie.getRootHash());
    assert.deepStrictEqual(actual.nodes, trie.nodes);
  });

  it("Test vector 9", () => {
    const vector = {
      input: { ...testVector9 },
      output: "f6ac87ea6258a68bd3288cf73ac9d03419b548858c5466b1927b796f29db13fc",
    };

    runTestVector(vector);
  });

  it("Test vector 10", () => {
    const vector = {
      input: {
        "5dffe0e2c9f089d30e50b04ee562445cf2c0e7e7d677580ef0ccf2c6fa3522dd":
          "bb11c256876fe10442213dd78714793394d2016134c28a64eb27376ddc147fc6044df72bdea44d9ec66a3ea1e6d523f7de71db1d05a980e001e9fa",
        df08871e8a54fde4834d83851469e635713615ab1037128df138a6cd223f1242: "b8bded4e1c",
        "7723a8383e43a1713eb920bae44880b2ae9225ea2d38c031cf3b22434b4507e7":
          "e46ddd41a5960807d528f5d9282568e622a023b94b72cb63f0353baff189257d",
        "3e7d409b9037b1fd870120de92ebb7285219ce4526c54701b888c5a13995f73c": "9bc5d0",
        c2d3bda8f77cc483d2f4368cf998203097230fd353d2223e5a333eb58f76a429:
          "9ae1dc59670bd3ef6fb51cbbbc05f1d2635fd548cb31f72500000a",
        "6bf8460545baf5b0af874ebbbd56ae09ee73cd24926b4549238b797b447e050a":
          "0964801caa928bc8c1869d60dbf1d8233233e0261baf725f2631d2b27574efc0316ce3067b4fccfa607274",
        "832c15668a451578b4c69974085280b4bac5b01e220398f06e06a1d0aff2859a": "4881dd3238fd6c8af1090d455e7b449a",
        c7a04effd2c0cede0279747f58bd210d0cc9d65c2eba265c6b4dfbc058a7047b:
          "d1fddfd63fd00cd6749a441b6ceaea1f250982a3a6b6d38f1b40cae00972cce3f9f4eaf7f9d7bc3070bd1e8d088500b10ca72e5ed5956f62",
        "9e78a15cc0b45c83c83218efadd234cbac22dbffb24a76e2eb5f6a81d32df616":
          "e8256c6b5a9623cf2b293090f78f8fbceea6fc3991ac5f872400608f14d2a8b3d494fcda1c51d93b9904e3242cdeaa4b227c68cea89cca05ab6b5296edf105",
        "03345958f90731bce89d07c2722dc693425a541b5230f99a6867882993576a23":
          "cd759a8d88edb46dda489a45ba6e48a42ce7efd36f1ca31d3bdfa40d2091f27740c5ec5de746d90d9841b986f575d545d0fb642398914eaab5",
      },
      output: "7d874bf70ea045e278f5cd2eafb28b74cdaee9c225ca884dee82532caa7bad0f",
    };

    runTestVector(vector);
  });

  it("should work with shorter keys as well", () => {
    const vector = {
      input: {
        "5dffe0e2c9f089d30e50b04ee562445cf2c0e7e7d677580ef0ccf2c6fa3522":
          "bb11c256876fe10442213dd78714793394d2016134c28a64eb27376ddc147fc6044df72bdea44d9ec66a3ea1e6d523f7de71db1d05a980e001e9fa",
        df08871e8a54fde4834d83851469e635713615ab1037128df138a6cd223f12: "b8bded4e1c",
        "7723a8383e43a1713eb920bae44880b2ae9225ea2d38c031cf3b22434b4507":
          "e46ddd41a5960807d528f5d9282568e622a023b94b72cb63f0353baff189257d",
        "3e7d409b9037b1fd870120de92ebb7285219ce4526c54701b888c5a13995f73c": "9bc5d0",
        c2d3bda8f77cc483d2f4368cf998203097230fd353d2223e5a333eb58f76a4:
          "9ae1dc59670bd3ef6fb51cbbbc05f1d2635fd548cb31f72500000a",
        "6bf8460545baf5b0af874ebbbd56ae09ee73cd24926b4549238b797b447e05":
          "0964801caa928bc8c1869d60dbf1d8233233e0261baf725f2631d2b27574efc0316ce3067b4fccfa607274",
        "832c15668a451578b4c69974085280b4bac5b01e220398f06e06a1d0aff285": "4881dd3238fd6c8af1090d455e7b449a",
        c7a04effd2c0cede0279747f58bd210d0cc9d65c2eba265c6b4dfbc058a704:
          "d1fddfd63fd00cd6749a441b6ceaea1f250982a3a6b6d38f1b40cae00972cce3f9f4eaf7f9d7bc3070bd1e8d088500b10ca72e5ed5956f62",
        "9e78a15cc0b45c83c83218efadd234cbac22dbffb24a76e2eb5f6a81d32df6":
          "e8256c6b5a9623cf2b293090f78f8fbceea6fc3991ac5f872400608f14d2a8b3d494fcda1c51d93b9904e3242cdeaa4b227c68cea89cca05ab6b5296edf105",
        // this one is intentionally left longer to show that we support both mixed.
        "03345958f90731bce89d07c2722dc693425a541b5230f99a6867882993576a23":
          "cd759a8d88edb46dda489a45ba6e48a42ce7efd36f1ca31d3bdfa40d2091f27740c5ec5de746d90d9841b986f575d545d0fb642398914eaab5",
      },
      output: "7d874bf70ea045e278f5cd2eafb28b74cdaee9c225ca884dee82532caa7bad0f",
    };

    runTestVector(vector);
  });

  function runTestVector(vector: {
    input: { [key: string]: string };
    output: string;
  }) {
    const trie = InMemoryTrie.empty(blake2bTrieHasher);

    for (const [key, val] of Object.entries(vector.input)) {
      const stateKey = parseInputKey(key);
      const value = BytesBlob.parseBlobNoPrefix(val);
      trie.set(stateKey, value);
    }

    const expected = Bytes.parseBytesNoPrefix(vector.output, 32);
    assert.deepStrictEqual(trie.getRootHash().toString(), expected.toString());
  }
});
