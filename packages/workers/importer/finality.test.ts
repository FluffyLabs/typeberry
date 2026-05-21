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
async function createBlock(db: InMemoryBlocks, parent: HeaderHash, slot = 0): Promise<HeaderHash> {
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

  await db.insertBlock(WithHash.new(headerHash, blockView));

  return headerHash;
}

/** Build a linear chain of `length` blocks starting from `parentHash`. */
async function buildLinearChain(db: InMemoryBlocks, parentHash: HeaderHash, length: number): Promise<HeaderHash[]> {
  const hashes: HeaderHash[] = [];
  let parent = parentHash;
  for (let i = 0; i < length; i++) {
    const h = await createBlock(db, parent, i);
    hashes.push(h);
    parent = h;
  }
  return hashes;
}

describe("DummyFinalizer", () => {
  describe("linear chain", () => {
    it("should return null when chain length is at most 2*depth", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 3);

      // 2*3 = 6 blocks: chain length = 6, not > 6, so no finality.
      const chain = await buildLinearChain(db, genesis, 6);

      for (const h of chain) {
        const result = finalizer.onBlockImported(h);
        assert.strictEqual(result, null);
      }
    });

    it("should finalize when chain length exceeds 2*depth", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 3);

      // Need > 2*3=6, so build 7 blocks.
      const chain = await buildLinearChain(db, genesis, 7);

      // First 6 imports: no finality (chain length <= 2*depth).
      for (let i = 0; i < 6; i++) {
        assert.strictEqual(finalizer.onBlockImported(chain[i]), null);
      }

      // 7th import: chain length = 7 > 6, finalize chain[3].
      const result = finalizer.onBlockImported(chain[6]);
      assertExists(result);
      assert.strictEqual(result.finalizedHash.isEqualTo(chain[3]), true);
    });

    it("should prune prev finalized and depth predecessors on first finality", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 3);

      const chain = await buildLinearChain(db, genesis, 7);
      for (let i = 0; i < 6; i++) {
        finalizer.onBlockImported(chain[i]);
      }

      const result = finalizer.onBlockImported(chain[6]);
      assertExists(result);
      // Prunable: genesis (prev finalized) + chain[0..2] = 4 items.
      assert.strictEqual(result.prunableStateHashes.length, 4);
      assert.ok(result.prunableStateHashes[0].isEqualTo(genesis));
      for (let i = 0; i < 3; i++) {
        assert.ok(result.prunableStateHashes[i + 1].isEqualTo(chain[i]));
      }
    });

    it("should advance finality in batches of depth blocks", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // depth=2: triggers at > 4 (length >= 5).
      // After trigger: remaining = 2 blocks. Next trigger needs 3 more (length 5).
      // Build enough for 3 triggers: 5 + 3 + 3 = 11 blocks.
      const chain = await buildLinearChain(db, genesis, 11);

      // First 4 imports: no finality (chain length <= 2*depth = 4).
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(finalizer.onBlockImported(chain[i]), null);
      }

      // 5th import: chain length = 5 > 4, finalize chain[2].
      const r1 = finalizer.onBlockImported(chain[4]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[2]), true);
      assert.strictEqual(r1.prunableStateHashes.length, 3);
      assert.ok(r1.prunableStateHashes[0].isEqualTo(genesis));
      assert.ok(r1.prunableStateHashes[1].isEqualTo(chain[0]));
      assert.ok(r1.prunableStateHashes[2].isEqualTo(chain[1]));

      // Next 2 imports: no finality (remaining chain = 2, need > 4).
      assert.strictEqual(finalizer.onBlockImported(chain[5]), null);
      assert.strictEqual(finalizer.onBlockImported(chain[6]), null);

      // 8th import: chain length = 5 > 4, finalize chain[5].
      const r2 = finalizer.onBlockImported(chain[7]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[5]), true);
      assert.strictEqual(r2.prunableStateHashes.length, 3);
      assert.ok(r2.prunableStateHashes[0].isEqualTo(chain[2]));
      assert.ok(r2.prunableStateHashes[1].isEqualTo(chain[3]));
      assert.ok(r2.prunableStateHashes[2].isEqualTo(chain[4]));

      // Next 2 imports: no finality.
      assert.strictEqual(finalizer.onBlockImported(chain[8]), null);
      assert.strictEqual(finalizer.onBlockImported(chain[9]), null);

      // 11th import: chain length = 5 > 4, finalize chain[8].
      const r3 = finalizer.onBlockImported(chain[10]);
      assertExists(r3);
      assert.strictEqual(r3.finalizedHash.isEqualTo(chain[8]), true);
      assert.strictEqual(r3.prunableStateHashes.length, 3);
      assert.ok(r3.prunableStateHashes[0].isEqualTo(chain[5]));
      assert.ok(r3.prunableStateHashes[1].isEqualTo(chain[6]));
      assert.ok(r3.prunableStateHashes[2].isEqualTo(chain[7]));
    });

    it("should not trigger between batch boundaries", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      const chain = await buildLinearChain(db, genesis, 5);

      // First 4: no finality (chain length <= 4).
      for (let i = 0; i < 4; i++) {
        assert.strictEqual(finalizer.onBlockImported(chain[i]), null);
      }

      // 5th: chain length = 5 > 4, finalize chain[2].
      const r1 = finalizer.onBlockImported(chain[4]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[2]), true);
    });
  });

  describe("with depth=1", () => {
    it("should finalize after 3 blocks and prune in batches of 2", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 1);

      const chain = await buildLinearChain(db, genesis, 6);

      // Import 1: length=1, not > 2. No finality.
      assert.strictEqual(finalizer.onBlockImported(chain[0]), null);

      // Import 2: length=2, not > 2. No finality.
      assert.strictEqual(finalizer.onBlockImported(chain[1]), null);

      // Import 3: length=3 > 2. Finalize chain[1].
      const r1 = finalizer.onBlockImported(chain[2]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[1]), true);
      // Prunable: genesis + chain[0] = 2 items.
      assert.strictEqual(r1.prunableStateHashes.length, 2);
      assert.ok(r1.prunableStateHashes[0].isEqualTo(genesis));
      assert.ok(r1.prunableStateHashes[1].isEqualTo(chain[0]));

      // Remaining = [chain[2]]. Need > 2, so 1 more block.
      assert.strictEqual(finalizer.onBlockImported(chain[3]), null);

      // Import 5: chain [chain[2], chain[3], chain[4]] length=3 > 2. Finalize chain[3].
      const r2 = finalizer.onBlockImported(chain[4]);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(chain[3]), true);
      assert.strictEqual(r2.prunableStateHashes.length, 2);
      assert.ok(r2.prunableStateHashes[0].isEqualTo(chain[1]));
      assert.ok(r2.prunableStateHashes[1].isEqualTo(chain[2]));
    });
  });

  describe("forks", () => {
    it("should track two forks and prune dead fork on finality", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // Fork A: genesis -> A1 -> A2 -> A3 -> A4 -> A5 (length 5 > 2*2 = triggers)
      const a1 = await createBlock(db, genesis, 1);
      const a2 = await createBlock(db, a1, 2);
      const a3 = await createBlock(db, a2, 3);
      const a4 = await createBlock(db, a3, 4);
      const a5 = await createBlock(db, a4, 5);

      // Fork B: genesis -> B1 -> B2
      const b1 = await createBlock(db, genesis, 10);
      const b2 = await createBlock(db, b1, 11);

      // Import A1..A4, B1, B2 — no finality.
      for (const h of [a1, a2, a3, a4, b1, b2]) {
        assert.strictEqual(finalizer.onBlockImported(h), null);
      }

      // Import A5: fork A length 5 > 4. Finalize A3 (index 2).
      const result = finalizer.onBlockImported(a5);
      assertExists(result);
      assert.strictEqual(result.finalizedHash.isEqualTo(a3), true);

      // Fork B [B1, B2] is dead (doesn't contain A3). B1 and B2 should be pruned.
      // Also: genesis (prev finalized) and A1, A2 pruned (before A3 in chain A).
      const prunedStrings = result.prunableStateHashes.map((h) => h.toString());
      assert.ok(prunedStrings.includes(genesis.toString()), "Genesis should be pruned");
      assert.ok(prunedStrings.includes(a1.toString()), "A1 should be pruned");
      assert.ok(prunedStrings.includes(a2.toString()), "A2 should be pruned");
      assert.ok(prunedStrings.includes(b1.toString()), "B1 should be pruned");
      assert.ok(prunedStrings.includes(b2.toString()), "B2 should be pruned");
      assert.ok(!prunedStrings.includes(a3.toString()), "A3 (finalized) should not be pruned");
    });

    it("should keep alive forks that diverge at or after the finalized block", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // Main chain: genesis -> M1 -> M2 -> M3 -> M4
      const m1 = await createBlock(db, genesis, 1);
      const m2 = await createBlock(db, m1, 2);
      const m3 = await createBlock(db, m2, 3);
      const m4 = await createBlock(db, m3, 4);

      // Fork from M3 (the block that will be finalized): M3 -> F1
      const f1 = await createBlock(db, m3, 20);

      // Import M1..M4. F1 creates a fork from the middle of the chain.
      // After importing M1..M4: chain [M1,M2,M3,M4], length 4 not > 4.
      for (const h of [m1, m2, m3, m4]) {
        finalizer.onBlockImported(h);
      }

      // Import F1: parent M3 is at index 2 (not tip M4). Fork: [M1,M2,M3,F1].
      finalizer.onBlockImported(f1);

      // Extend main chain to trigger finality.
      const m5 = await createBlock(db, m4, 5);

      // Import M5: main chain [M1,M2,M3,M4,M5] length 5 > 4. Finalize M3.
      const r1 = finalizer.onBlockImported(m5);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(m3), true);

      // Both chains contain M3:
      // Main [M1,M2,M3,M4,M5]: M3 at index 2. Prune M1,M2. Remaining: [M4,M5].
      // Fork [M1,M2,M3,F1]: M3 at index 2. Prune M1,M2. Remaining: [F1].
      const pruned1 = r1.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned1.includes(genesis.toString()), "Genesis should be pruned");
      assert.ok(!pruned1.includes(m3.toString()), "M3 (finalized) should not be pruned");
      assert.ok(!pruned1.includes(m4.toString()), "M4 should not be pruned (alive)");
      assert.ok(!pruned1.includes(f1.toString()), "F1 should not be pruned (alive)");

      // Extend fork to trigger next finality round.
      const f2 = await createBlock(db, f1, 21);
      const f3 = await createBlock(db, f2, 22);
      const f4 = await createBlock(db, f3, 23);
      const f5 = await createBlock(db, f4, 24);

      // [F1] length 1, [M4,M5] length 2. No finality yet.
      assert.strictEqual(finalizer.onBlockImported(f2), null);
      assert.strictEqual(finalizer.onBlockImported(f3), null);
      assert.strictEqual(finalizer.onBlockImported(f4), null);

      // Import F5: fork chain [F1,F2,F3,F4,F5] length 5 > 4. Finalize F3 (index 2).
      // Main chain [M4,M5] doesn't contain F3 → dead fork, prune M4,M5.
      const r2 = finalizer.onBlockImported(f5);
      assertExists(r2);
      assert.strictEqual(r2.finalizedHash.isEqualTo(f3), true);

      const pruned2 = r2.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned2.includes(m3.toString()), "M3 (prev finalized) should be pruned");
      assert.ok(pruned2.includes(m4.toString()), "M4 should be pruned (dead fork)");
      assert.ok(pruned2.includes(m5.toString()), "M5 should be pruned (dead fork)");
      assert.ok(pruned2.includes(f1.toString()), "F1 should be pruned (before finalized)");
      assert.ok(pruned2.includes(f2.toString()), "F2 should be pruned (before finalized)");
      assert.ok(!pruned2.includes(f3.toString()), "F3 (finalized) should not be pruned");
    });

    it("should prune a dead fork that diverged before the finalized block", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // Main: genesis -> 1 -> 2 -> 3 -> 4 -> 5
      const chain = await buildLinearChain(db, genesis, 5);

      // Fork from genesis: genesis -> F1 -> F2
      const f1 = await createBlock(db, genesis, 100);
      const f2 = await createBlock(db, f1, 101);

      // Import main chain and fork — no finality yet.
      for (const h of chain.slice(0, 4)) {
        finalizer.onBlockImported(h);
      }
      finalizer.onBlockImported(f1);
      finalizer.onBlockImported(f2);

      // Import 5th block: main chain length 5 > 4, finalize chain[2].
      const r1 = finalizer.onBlockImported(chain[4]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[2]), true);

      // Fork [F1,F2] doesn't contain chain[2], so it's dead.
      const pruned1 = r1.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned1.includes(genesis.toString()), "Genesis should be pruned");
      assert.ok(pruned1.includes(f1.toString()), "F1 should be pruned");
      assert.ok(pruned1.includes(f2.toString()), "F2 should be pruned");
    });

    it("should handle fork from the middle of a chain", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // Main: genesis -> 1 -> 2 -> 3 -> 4
      const b1 = await createBlock(db, genesis, 1);
      const b2 = await createBlock(db, b1, 2);
      const b3 = await createBlock(db, b2, 3);
      const b4 = await createBlock(db, b3, 4);

      // Fork from block 2: 2 -> F1 -> F2 -> F3
      const f1 = await createBlock(db, b2, 10);
      const f2 = await createBlock(db, f1, 11);
      const f3 = await createBlock(db, f2, 12);

      // Import main chain first.
      finalizer.onBlockImported(b1);
      finalizer.onBlockImported(b2);
      finalizer.onBlockImported(b3);
      // Import b4: chain [b1,b2,b3,b4] length 4, not > 4.
      finalizer.onBlockImported(b4);

      // Import fork — F1's parent is b2 which is mid-chain.
      finalizer.onBlockImported(f1);
      finalizer.onBlockImported(f2);

      // Import F3: fork chain = [b1, b2, f1, f2, f3], length 5 > 4.
      // Finalize block at index 5-1-2 = 2 → f1.
      // Main chain [b1,b2,b3,b4] doesn't contain f1 → dead.
      const r = finalizer.onBlockImported(f3);
      assertExists(r);
      assert.strictEqual(r.finalizedHash.isEqualTo(f1), true);

      const pruned = r.prunableStateHashes.map((h) => h.toString());
      assert.ok(pruned.includes(b1.toString()), "B1 should be pruned");
      assert.ok(pruned.includes(b2.toString()), "B2 should be pruned");
      assert.ok(pruned.includes(b3.toString()), "B3 should be pruned (dead fork)");
      assert.ok(pruned.includes(b4.toString()), "B4 should be pruned (dead fork)");
    });
  });

  describe("edge cases", () => {
    it("should return null for unknown block hash", async () => {
      const db = InMemoryBlocks.new();

      const finalizer = DummyFinalizer.create(db, 3);
      // Create a block hash that was never inserted into the db.
      const unknownHash = await createBlock(InMemoryBlocks.new(), db.getBestHeaderHash());
      const result = finalizer.onBlockImported(unknownHash);
      assert.strictEqual(result, null);
    });

    it("should return null for orphan block (parent not in any chain)", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // Block whose parent is some unknown hash not in any chain.
      // We create a separate db to get a "foreign" hash, then insert the orphan
      // into our db with that foreign hash as parent.
      const foreignDb = InMemoryBlocks.new();
      const foreignParent = await createBlock(foreignDb, genesis, 99);

      const orphan = await createBlock(db, foreignParent, 50);

      const result = finalizer.onBlockImported(orphan);
      assert.strictEqual(result, null);
    });

    it("should always advance finality forward, never re-finalizing earlier blocks", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      const finalizer = DummyFinalizer.create(db, 2);

      // genesis -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
      const chain = await buildLinearChain(db, genesis, 7);

      // First 4: no finality.
      for (let i = 0; i < 4; i++) {
        finalizer.onBlockImported(chain[i]);
      }

      // Block 5: chain length 5 > 4, finalize chain[2].
      const r1 = finalizer.onBlockImported(chain[4]);
      assertExists(r1);
      assert.strictEqual(r1.finalizedHash.isEqualTo(chain[2]), true);

      // Block 6: remaining chain length 2, not > 4. No finality.
      assert.strictEqual(finalizer.onBlockImported(chain[5]), null);

      // Block 7: chain length 3, not > 4. No finality.
      assert.strictEqual(finalizer.onBlockImported(chain[6]), null);
    });

    it("should work with depth=0", async () => {
      const db = InMemoryBlocks.new();
      const genesis = db.getBestHeaderHash();

      // depth=0 means finalize as soon as any block exists (2*0=0, length > 0).
      const finalizer = DummyFinalizer.create(db, 0);

      const b1 = await createBlock(db, genesis, 1);

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
