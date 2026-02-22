import assert from "node:assert";
import { before, describe, it } from "node:test";
import {
  Block,
  DisputesExtrinsic,
  Extrinsic,
  Header,
  type HeaderHash,
  reencodeAsView,
  tryAsTimeSlot,
} from "@typeberry/block";

import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { InMemoryBlocks } from "@typeberry/database";
import { Blake2b, WithHash } from "@typeberry/hash";
import { DummyFinalizer } from "./finality.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

function assertExists<T>(value: T): asserts value is NonNullable<T> {
  assert.notStrictEqual(value, null);
  assert.notStrictEqual(value, undefined);
}

/**
 * Create a block with the given parent hash and slot, insert it into the db,
 * and return its hash.
 */
function createBlock(db: InMemoryBlocks, parent: HeaderHash, slot = 0): HeaderHash {
  const header = Header.create({
    ...Header.empty(),
    parentHeaderHash: parent,
    timeSlotIndex: tryAsTimeSlot(slot),
  });

  const block = Block.create({
    header,
    extrinsic: Extrinsic.create({
      tickets: asKnownSize([]),
      preimages: [],
      assurances: asKnownSize([]),
      guarantees: asKnownSize([]),
      disputes: DisputesExtrinsic.create({ verdicts: [], culprits: [], faults: [] }),
    }),
  });

  const blockView = reencodeAsView(Block.Codec, block, tinyChainSpec);
  const headerHash = blake2b.hashBytes(blockView.header.view().encoded()).asOpaque<HeaderHash>();

  db.insertBlock(new WithHash(headerHash, blockView));

  return headerHash;
}

/** Build a linear chain of `length` blocks starting from `parentHash`. */
function buildLinearChain(db: InMemoryBlocks, parentHash: HeaderHash, length: number): HeaderHash[] {
  const hashes: HeaderHash[] = [];
  let parent = parentHash;
  for (let i = 0; i < length; i++) {
    const h = createBlock(db, parent, i);
    hashes.push(h);
    parent = h;
  }
  return hashes;
}

describe("DummyFinalizer", () => {
  describe("linear chain", () => {
    it("should return null when chain is shorter than depth", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 3);

      // Build a chain of 3 blocks: genesis -> 1 -> 2 -> 3
      const chain = buildLinearChain(db, genesis, 3);

      // Import all 3 — chain length = depth, not > depth, so no finality.
      for (const h of chain) {
        const result = finalizer.onBlockImported(h);
        assert.strictEqual(result, null);
      }
    });

    it("should finalize when chain exceeds depth", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 3);

      // Build: genesis -> 1 -> 2 -> 3 -> 4
      const chain = buildLinearChain(db, genesis, 4);

      // First 3 imports: no finality.
      for (let i = 0; i < 3; i++) {
        assert.strictEqual(finalizer.onBlockImported(chain[i]), null);
      }

      // 4th import: chain length = 4 > depth(3), finalize block at index 0.
      const result = finalizer.onBlockImported(chain[3]);
      assertExists(result);
      assert.strictEqual(result.finalizedHash.isEqualTo(chain[0]), true);
    });

    it("should prune the previously finalized block on first finality", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 3);

      const chain = buildLinearChain(db, genesis, 4);
      for (let i = 0; i < 3; i++) {
        finalizer.onBlockImported(chain[i]);
      }

      const result = finalizer.onBlockImported(chain[3]);
      assertExists(result);
      // Block 1 is finalized. The previously finalized block (genesis) is pruned.
      assert.strictEqual(result.prunableStateHashes.length, 1);
      assert.ok(result.prunableStateHashes[0].isEqualTo(genesis));
    });

    it("should advance finality one block at a time, pruning previous finalized each time", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Build: genesis -> 1 -> 2 -> 3 -> 4 -> 5
      const chain = buildLinearChain(db, genesis, 5);

      // Import 1, 2: no finality (length <= depth)
      assert.strictEqual(finalizer.onBlockImported(chain[0]), null);
      assert.strictEqual(finalizer.onBlockImported(chain[1]), null);

      // Import 3: length=3 > depth=2, finalize block 1. Prune genesis.
      const r1 = finalizer.onBlockImported(chain[2]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[0]), true);
      assert.strictEqual(r1.prunableStateHashes.length, 1);
      assert.ok(r1.prunableStateHashes[0].isEqualTo(genesis));

      // Import 4: finalize block 2. Prune block 1 (previous finalized).
      const r2 = finalizer.onBlockImported(chain[3]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[1]), true);
      assert.strictEqual(r2.prunableStateHashes.length, 1);
      assert.ok(r2.prunableStateHashes[0].isEqualTo(chain[0]));

      // Import 5: finalize block 3. Prune block 2 (previous finalized).
      const r3 = finalizer.onBlockImported(chain[4]);
      assertExists(r3);
      assert.strictEqual(r3.finalizedHash.isEqualTo(chain[2]), true);
      assert.strictEqual(r3.prunableStateHashes.length, 1);
      assert.ok(r3.prunableStateHashes[0].isEqualTo(chain[1]));
    });

    it("should advance finality on every import even when blocks arrive in a burst", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Build: genesis -> 1 -> 2 -> 3 -> 4 -> 5
      const chain = buildLinearChain(db, genesis, 5);

      // Import blocks 1..4 — finality fires on block 3 and block 4.
      assert.strictEqual(finalizer.onBlockImported(chain[0]), null);
      assert.strictEqual(finalizer.onBlockImported(chain[1]), null);

      // Block 3: chain [1,2,3] length=3 > depth=2 → finalize block 1.
      const r1 = finalizer.onBlockImported(chain[2]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[0]), true);

      // Block 4: chain [2,3,4] length=3 > depth=2 → finalize block 2.
      const r2 = finalizer.onBlockImported(chain[3]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[1]), true);

      // Block 5: chain [3,4,5] length=3 > depth=2 → finalize block 3.
      const r3 = finalizer.onBlockImported(chain[4]);
      assertExists(r3);
      assert.strictEqual(r3.finalizedHash.isEqualTo(chain[2]), true);
    });
  });

  describe("with depth=1", () => {
    it("should finalize immediately after 2 blocks", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 1);

      const chain = buildLinearChain(db, genesis, 3);

      // Import 1: length=1, not > 1. No finality.
      assert.strictEqual(finalizer.onBlockImported(chain[0]), null);

      // Import 2: length=2 > 1. Finalize block 1.
      const r = finalizer.onBlockImported(chain[1]);
      assertExists(r);
      assert.strictEqual(r.finalizedHash.isEqualTo(chain[0]), true);

      // Import 3: finalize block 2.
      const r2 = finalizer.onBlockImported(chain[2]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[1]), true);
    });
  });

  describe("forks", () => {
    it("should track two forks from the finalized block", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Fork A: genesis -> A1 -> A2 -> A3
      const a1 = createBlock(db, genesis, 1);
      const a2 = createBlock(db, a1, 2);
      const a3 = createBlock(db, a2, 3);

      // Fork B: genesis -> B1 -> B2
      const b1 = createBlock(db, genesis, 10);
      const b2 = createBlock(db, b1, 11);

      // Import A1, A2, B1, B2 — no finality yet.
      assert.strictEqual(finalizer.onBlockImported(a1), null);
      assert.strictEqual(finalizer.onBlockImported(a2), null);
      assert.strictEqual(finalizer.onBlockImported(b1), null);
      assert.strictEqual(finalizer.onBlockImported(b2), null);

      // Import A3: fork A has length 3 > depth 2. Finalize A1.
      const result = finalizer.onBlockImported(a3);
      assertExists(result);
      assert.strictEqual(result.finalizedHash.isEqualTo(a1), true);

      // Fork B is dead (doesn't contain A1). B1 and B2 should be pruned.
      // Also, the previous finalized (genesis) is pruned.
      const prunedStrings = result.prunableStateHashes.map((h) => h.toString());
      assert.ok(prunedStrings.includes(genesis.toString()), "Genesis (prev finalized) should be pruned");
      assert.ok(prunedStrings.includes(b1.toString()), "B1 should be pruned");
      assert.ok(prunedStrings.includes(b2.toString()), "B2 should be pruned");
      // A1 is the finalized block — should NOT be pruned.
      assert.ok(!prunedStrings.includes(a1.toString()), "A1 (finalized) should not be pruned");
    });

    it("should keep alive forks that diverge after the finalized block", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Main chain: genesis -> 1 -> 2 -> 3
      const b1 = createBlock(db, genesis, 1);
      const b2 = createBlock(db, b1, 2);
      const b3 = createBlock(db, b2, 3);

      // Fork from block 2: 2 -> F1
      const f1 = createBlock(db, b2, 20);

      // Import 1, 2 — no finality yet (chain length 2 = depth 2).
      finalizer.onBlockImported(b1);
      finalizer.onBlockImported(b2);

      // Import F1: fork chain [b1, b2, f1] has length 3 > depth 2.
      // This triggers finality for b1.
      const r1 = finalizer.onBlockImported(f1);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(b1), true);

      // Both chains contain b1: main [b1, b2] → alive, trimmed to [b2].
      // Fork [b1, b2, f1] → alive, trimmed to [b2, f1].
      // Only the previous finalized (genesis) is pruned.
      assert.strictEqual(r1.prunableStateHashes.length, 1);
      assert.ok(r1.prunableStateHashes[0].isEqualTo(genesis));

      // Now import b3: it extends the main chain [b2] → [b2, b3].
      // Length 2, not > depth 2. No finality.
      const r2 = finalizer.onBlockImported(b3);
      assert.strictEqual(r2, null);

      // Extend the fork: F1 -> F2 -> F3
      const f2 = createBlock(db, f1, 21);
      const f3 = createBlock(db, f2, 22);

      // Import F2: fork chain becomes [b2, f1, f2], length=3 > depth=2.
      // Finalize b2 (index 0). Both chains contain b2, so both are alive.
      // unfinalized becomes [[b3], [f1, f2]]. Only prev finalized (b1) pruned.
      const r3 = finalizer.onBlockImported(f2);
      assertExists(r3);
      assert.strictEqual(r3.finalizedHash.isEqualTo(b2), true);
      assert.strictEqual(r3.prunableStateHashes.length, 1);
      assert.ok(r3.prunableStateHashes[0].isEqualTo(b1));

      // Import F3: fork chain becomes [f1, f2, f3], length=3 > depth=2.
      // Finalize f1 (index 0). Main chain [b3] doesn't contain f1 → dead.
      const r4 = finalizer.onBlockImported(f3);
      assertExists(r4);
      assert.strictEqual(r4.finalizedHash.isEqualTo(f1), true);

      const pruned = r4.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned.includes(b2.toString()), "B2 (prev finalized) should be pruned");
      assert.ok(pruned.includes(b3.toString()), "B3 should be pruned (dead fork)");
      assert.ok(!pruned.includes(f1.toString()), "F1 should not be pruned (finalized)");
      assert.ok(!pruned.includes(f2.toString()), "F2 should not be pruned (after finalized)");
      assert.ok(!pruned.includes(f3.toString()), "F3 should not be pruned (after finalized)");
    });

    it("should prune a dead fork that diverged before the finalized block", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Main: genesis -> 1 -> 2 -> 3 -> 4
      const chain = buildLinearChain(db, genesis, 4);

      // Fork from genesis: genesis -> F1 -> F2
      const f1 = createBlock(db, genesis, 100);
      const f2 = createBlock(db, f1, 101);

      // Import: 1, 2, F1, F2, 3 (finalize block 1), 4 (finalize block 2)
      finalizer.onBlockImported(chain[0]);
      finalizer.onBlockImported(chain[1]);
      finalizer.onBlockImported(f1);
      finalizer.onBlockImported(f2);

      // Import 3: main chain length=3 > depth=2, finalize block 1.
      const r1 = finalizer.onBlockImported(chain[2]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[0]), true);

      // Fork [F1, F2] doesn't contain block 1, so it's dead.
      // Also, the previous finalized (genesis) is pruned.
      const pruned1 = r1.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned1.includes(genesis.toString()), "Genesis (prev finalized) should be pruned");
      assert.ok(pruned1.includes(f1.toString()), "F1 should be pruned");
      assert.ok(pruned1.includes(f2.toString()), "F2 should be pruned");
    });

    it("should handle fork from the middle of a chain", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Main: genesis -> 1 -> 2 -> 3
      const b1 = createBlock(db, genesis, 1);
      const b2 = createBlock(db, b1, 2);
      const b3 = createBlock(db, b2, 3);

      // Fork from block 1: 1 -> F1 -> F2 -> F3
      const f1 = createBlock(db, b1, 10);
      const f2 = createBlock(db, f1, 11);
      const f3 = createBlock(db, f2, 12);

      // Import main chain first.
      finalizer.onBlockImported(b1);
      finalizer.onBlockImported(b2);
      finalizer.onBlockImported(b3);

      // Import fork — F1's parent is b1 which is mid-chain, not a tip.
      finalizer.onBlockImported(f1);
      finalizer.onBlockImported(f2);

      // Import F3: fork chain = [b1, f1, f2, f3], length=4 > depth=2.
      // Finalize block at index 4-1-2 = 1 → f1.
      // But wait — the main chain [b1, b2, b3] also has length 3 > 2.
      // Block 3 import already triggered finality for b1.
      // After that, main chain trimmed to [b2, b3].
      // Fork was created from mid-chain of [b1, b2, b3] at b1.
      // But b1 was already part of the chain before finality.
      // After finality of b1: unfinalized = [[b2, b3]].
      // Now F1's parent is b1 = lastFinalized, so it starts a new chain: [f1].
      // F2 extends it: [f1, f2]. F3 extends: [f1, f2, f3]. Length=3 > 2.
      // Finalize f1. Main chain [b2, b3] doesn't contain f1 → dead fork.
      const r = finalizer.onBlockImported(f3);
      assertExists(r);
      assert.strictEqual(r.finalizedHash.isEqualTo(f1), true);

      const pruned = r.prunableStateHashes.map((h) => h.toString());
      // Previous finalized (b1) is pruned, plus main chain [b2, b3] is dead.
      assert.ok(pruned.includes(b1.toString()), "B1 (prev finalized) should be pruned");
      assert.ok(pruned.includes(b2.toString()), "B2 should be pruned (dead fork)");
      assert.ok(pruned.includes(b3.toString()), "B3 should be pruned (dead fork)");
    });
  });

  describe("edge cases", () => {
    it("should return null for unknown block hash", () => {
      const db = InMemoryBlocks.new();

      const finalizer = new DummyFinalizer(db, 3);
      // Create a block hash that was never inserted into the db.
      const unknownHash = createBlock(InMemoryBlocks.new(), db.getBestHeaderHash());
      const result = finalizer.onBlockImported(unknownHash);
      assert.strictEqual(result, null);
    });

    it("should return null for orphan block (parent not in any chain)", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // Block whose parent is some unknown hash not in any chain.
      // We create a separate db to get a "foreign" hash, then insert the orphan
      // into our db with that foreign hash as parent.
      const foreignDb = InMemoryBlocks.new();
      const foreignParent = createBlock(foreignDb, genesis, 99);

      const orphan = createBlock(db, foreignParent, 50);

      const result = finalizer.onBlockImported(orphan);
      assert.strictEqual(result, null);
    });

    it("should always advance finality forward, never re-finalizing earlier blocks", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = new DummyFinalizer(db, 2);

      // genesis -> 1 -> 2 -> 3 -> 4
      const chain = buildLinearChain(db, genesis, 4);

      finalizer.onBlockImported(chain[0]);
      finalizer.onBlockImported(chain[1]);

      // Block 3 finalizes block 1.
      const r1 = finalizer.onBlockImported(chain[2]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[0]), true);

      // Block 4 finalizes block 2. Block 1 (prev finalized) is pruned.
      const r2 = finalizer.onBlockImported(chain[3]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[1]), true);
      // Block 1 appears exactly once (as previous finalized, not re-finalized).
      const pruned = r2.prunableStateHashes.map((h) => h.toString());
      assert.strictEqual(pruned.filter((h) => h === chain[0].toString()).length, 1);
      // The newly finalized block (chain[1]) should NOT be pruned.
      assert.ok(!pruned.includes(chain[1].toString()), "Newly finalized block should not be pruned");
    });

    it("should work with depth=0", () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      // depth=0 means finalize as soon as any block exists.
      const finalizer = new DummyFinalizer(db, 0);

      const b1 = createBlock(db, genesis, 1);

      // Chain length = 1 > 0 → finalize block at index 1-1-0 = 0 → b1.
      // Genesis (prev finalized) is pruned.
      const result = finalizer.onBlockImported(b1);
      assertExists(result);
      assert.strictEqual(result.finalizedHash.isEqualTo(b1), true);
      assert.strictEqual(result.prunableStateHashes.length, 1);
      assert.ok(result.prunableStateHashes[0].isEqualTo(genesis));
    });
  });
});
