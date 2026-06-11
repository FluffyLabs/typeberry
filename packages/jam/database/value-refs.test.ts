import assert from "node:assert";
import { describe, it } from "node:test";
import type { HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import type { ValueHash } from "@typeberry/trie";
import { type CountStore, type DeltaStore, type ValueDelta, ValueRefs, type ValueStore } from "./value-refs.js";

function vh(n: number): ValueHash {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

function hh(n: number): HeaderHash {
  return Bytes.fill(HASH_SIZE, n).asOpaque();
}

class MapCounts implements CountStore {
  private readonly m = new Map<string, number>();
  get(h: ValueHash): number {
    return this.m.get(h.toString()) ?? 0;
  }
  set(h: ValueHash, count: number): void {
    this.m.set(h.toString(), count);
  }
  delete(h: ValueHash): void {
    this.m.delete(h.toString());
  }
}

class MapDeltas implements DeltaStore {
  private readonly m = new Map<string, ValueDelta>();
  get(h: HeaderHash): ValueDelta | undefined {
    return this.m.get(h.toString());
  }
  set(h: HeaderHash, delta: ValueDelta): void {
    this.m.set(h.toString(), delta);
  }
  delete(h: HeaderHash): void {
    this.m.delete(h.toString());
  }
}

/** Tracks which value hashes are present in the (simulated) values DB. */
class TrackingValues implements ValueStore {
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
  const finalized = new MapCounts();
  const pending = new MapCounts();
  const deltas = new MapDeltas();
  const values = new TrackingValues();
  const refs = new ValueRefs(finalized, pending, deltas, values);
  return { refs, values };
}

/** Simulate importing a block: write inserted values + record the delta. */
function importBlock(refs: ValueRefs, values: TrackingValues, header: HeaderHash, delta: Partial<ValueDelta>): void {
  const full: ValueDelta = { inserted: delta.inserted ?? [], removed: delta.removed ?? [] };
  for (const v of full.inserted) {
    values.write(v);
  }
  refs.onImport(header, full);
}

describe("ValueRefs", () => {
  it("deletes a value once its only finalized reference is removed", () => {
    const { refs, values } = setup();
    const V = vh(1);

    importBlock(refs, values, hh(1), { inserted: [V] });
    refs.commitFinalized([hh(1)]);
    assert.ok(values.has(V), "kept while referenced by finalized tip");

    importBlock(refs, values, hh(2), { removed: [V] });
    refs.commitFinalized([hh(2)]);

    assert.ok(!values.has(V), "deleted after last finalized reference removed");
  });

  it("keeps a value referenced under multiple keys until all references are gone", () => {
    const { refs, values } = setup();
    const V = vh(1);

    importBlock(refs, values, hh(1), { inserted: [V] });
    refs.commitFinalized([hh(1)]);
    importBlock(refs, values, hh(2), { inserted: [V] });
    refs.commitFinalized([hh(2)]);

    importBlock(refs, values, hh(3), { removed: [V] });
    refs.commitFinalized([hh(3)]);
    assert.ok(values.has(V), "kept while one reference remains");

    importBlock(refs, values, hh(4), { removed: [V] });
    refs.commitFinalized([hh(4)]);
    assert.ok(!values.has(V), "deleted after the last reference");
  });

  it("keeps a value removed on the finalized chain while an unfinalized fork re-adds it", () => {
    const { refs, values } = setup();
    const V = vh(1);

    // genesis already references V
    refs.onInitial([V]);
    values.write(V);

    // finalized chain removes V
    importBlock(refs, values, hh(10), { removed: [V] });
    // an unfinalized fork re-adds V
    importBlock(refs, values, hh(20), { inserted: [V] });

    refs.commitFinalized([hh(10)]);

    assert.ok(values.has(V), "kept because an unfinalized fork still references V");
  });

  it("collects a value that lived only on a discarded fork", () => {
    const { refs, values } = setup();
    const W = vh(2);

    importBlock(refs, values, hh(30), { inserted: [W] });
    assert.ok(values.has(W));

    const wasUnfinalized = refs.releaseUnfinalized(hh(30));

    assert.strictEqual(wasUnfinalized, true);
    assert.ok(!values.has(W), "dead-fork-only value is collected");
  });

  it("does not touch finalized references when releasing an already finalized header", () => {
    const { refs, values } = setup();
    const V = vh(1);

    importBlock(refs, values, hh(1), { inserted: [V] });
    refs.commitFinalized([hh(1)]);

    const wasUnfinalized = refs.releaseUnfinalized(hh(1));

    assert.strictEqual(wasUnfinalized, false, "header was already finalized");
    assert.ok(values.has(V), "finalized value is untouched");
  });

  it("ignores unknown headers in commitFinalized", () => {
    const { refs } = setup();
    assert.doesNotThrow(() => refs.commitFinalized([hh(99)]));
  });
});
