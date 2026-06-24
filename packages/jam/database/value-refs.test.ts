import assert from "node:assert";
import { describe, it } from "node:test";
import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { ValueHash } from "@typeberry/trie";
import {
  InMemoryValueRefsStore,
  isEmptyUpdate,
  type ValueDelta,
  ValueRefs,
  type ValueRefsUpdate,
} from "./value-refs.js";

function vh(n: number): ValueHash {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

function hh(n: number): HeaderHash {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

/** Tracks which value hashes are present in the (simulated) values DB. */
class TrackingValues {
  readonly present = new Set<string>();
  write(h: ValueHash): void {
    this.present.add(h.toString());
  }
  delete(h: ValueHash): void {
    this.present.delete(h.toString());
  }
  has(h: ValueHash): boolean {
    return this.present.has(h.toString());
  }
}

function setup() {
  const store = new InMemoryValueRefsStore();
  const refs = new ValueRefs(store);
  const values = new TrackingValues();
  // what every backend is expected to do with an update
  const apply = (update: ValueRefsUpdate) => {
    store.apply(update);
    for (const v of update.removeValues) {
      values.delete(v);
    }
  };
  return { refs, store, values, apply };
}

type Setup = ReturnType<typeof setup>;

/** Simulate importing a block: write inserted values + record the delta. */
function importBlock({ refs, values, apply }: Setup, header: HeaderHash, delta: Partial<ValueDelta>): void {
  const full: ValueDelta = { inserted: delta.inserted ?? [], removed: delta.removed ?? [] };
  for (const v of full.inserted) {
    values.write(v);
  }
  apply(refs.onImport(header, full));
}

describe("ValueRefs", () => {
  it("deletes a value once its only finalized reference is removed", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    apply(refs.commitFinalized([hh(1)]));
    assert.ok(values.has(V), "kept while referenced by finalized tip");

    importBlock(s, hh(2), { removed: [V] });
    apply(refs.commitFinalized([hh(2)]));

    assert.ok(!values.has(V), "deleted after last finalized reference removed");
  });

  it("keeps a value referenced under multiple keys until all references are gone", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    apply(refs.commitFinalized([hh(1)]));
    importBlock(s, hh(2), { inserted: [V] });
    apply(refs.commitFinalized([hh(2)]));

    importBlock(s, hh(3), { removed: [V] });
    apply(refs.commitFinalized([hh(3)]));
    assert.ok(values.has(V), "kept while one reference remains");

    importBlock(s, hh(4), { removed: [V] });
    apply(refs.commitFinalized([hh(4)]));
    assert.ok(!values.has(V), "deleted after the last reference");
  });

  it("keeps a value removed on the finalized chain while an unfinalized fork re-adds it", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    // genesis already references V
    apply(refs.onInitial([V]));
    values.write(V);

    // finalized chain removes V
    importBlock(s, hh(10), { removed: [V] });
    // an unfinalized fork re-adds V
    importBlock(s, hh(20), { inserted: [V] });

    apply(refs.commitFinalized([hh(10)]));

    assert.ok(values.has(V), "kept because an unfinalized fork still references V");
  });

  it("collects a value that lived only on a discarded fork", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const W = vh(2);

    importBlock(s, hh(30), { inserted: [W] });
    assert.ok(values.has(W));

    const update = refs.releaseUnfinalized(hh(30));
    apply(update);

    assert.strictEqual(isEmptyUpdate(update), false);
    assert.ok(!values.has(W), "dead-fork-only value is collected");
  });

  it("does not touch finalized references when releasing an already finalized header", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    apply(refs.commitFinalized([hh(1)]));

    const update = refs.releaseUnfinalized(hh(1));
    apply(update);

    assert.strictEqual(isEmptyUpdate(update), true, "header was already finalized");
    assert.ok(values.has(V), "finalized value is untouched");
  });

  it("ignores unknown headers in commitFinalized", () => {
    const { refs } = setup();
    const update = refs.commitFinalized([hh(99)]);
    assert.strictEqual(isEmptyUpdate(update), true);
  });

  it("ignores a duplicate import of the same header", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    const second = refs.onImport(hh(1), { inserted: [V], removed: [] });
    assert.strictEqual(isEmptyUpdate(second), true, "duplicate import is a no-op");

    // had the duplicate bumped `pending` twice, releasing the fork would leave
    // a dangling count and the value would never be collected
    apply(refs.releaseUnfinalized(hh(1)));
    assert.ok(!values.has(V));
  });

  it("counts a header only once within a single commitFinalized call", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    apply(refs.commitFinalized([hh(1), hh(1)]));

    importBlock(s, hh(2), { removed: [V] });
    apply(refs.commitFinalized([hh(2)]));
    assert.ok(!values.has(V), "a double-counted finalized reference would keep the value alive");
  });

  it("does not remove a value re-referenced later within the same batch", () => {
    const s = setup();
    const { refs, values, apply } = s;
    const V = vh(1);

    apply(refs.onInitial([V]));
    values.write(V);

    // one block removes V, its descendant re-adds it; both finalize at once
    importBlock(s, hh(1), { removed: [V] });
    importBlock(s, hh(2), { inserted: [V] });
    const update = refs.commitFinalized([hh(1), hh(2)]);
    apply(update);

    assert.strictEqual(update.removeValues.length, 0);
    assert.ok(values.has(V), "the re-added reference keeps the value alive");
  });

  it("emits absolute counts so re-applying an update is harmless", () => {
    const s = setup();
    const { refs, store, values, apply } = s;
    const V = vh(1);

    importBlock(s, hh(1), { inserted: [V] });
    const update = refs.commitFinalized([hh(1)]);
    apply(update);
    // crash-replay: same batch applied again
    apply(update);

    assert.strictEqual(store.getFinalizedCount(V), 1);
    assert.strictEqual(store.getPendingCount(V), 0);

    importBlock(s, hh(2), { removed: [V] });
    apply(refs.commitFinalized([hh(2)]));
    assert.ok(!values.has(V), "refcounting still exact after replay");
  });
});
