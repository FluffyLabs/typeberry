import type { HeaderHash } from "@typeberry/block";
import type { ValueHash } from "@typeberry/trie";

/** The value hashes a single block introduced and stopped referencing. */
export interface ValueDelta {
  /** Value hashes (non-embedded) that the block started referencing. */
  inserted: ValueHash[];
  /** Value hashes (non-embedded) that the block stopped referencing. */
  removed: ValueHash[];
}

/** A persistent `ValueHash -> count` mapping. Missing keys are read as `0`. */
export interface CountStore {
  get(hash: ValueHash): number;
  set(hash: ValueHash, count: number): void;
  delete(hash: ValueHash): void;
}

/** A persistent `HeaderHash -> ValueDelta` mapping for not-yet-finalized blocks. */
export interface DeltaStore {
  get(header: HeaderHash): ValueDelta | undefined;
  set(header: HeaderHash, delta: ValueDelta): void;
  delete(header: HeaderHash): void;
}

/** Access to the values DB, limited to removal. */
export interface ValueStore {
  delete(hash: ValueHash): void;
}

/**
 * Decides when a content-addressed value can be removed from the values DB.
 *
 * A value is needed as long as some surviving state references it. Surviving
 * states are the finalized tip plus its unfinalized descendants, so we track:
 * - `finalized`: how many leaves in the current finalized-tip state reference V,
 *   advanced strictly by replaying finalized blocks' deltas (never on prune);
 * - `pending`: how many surviving, not-yet-finalized blocks inserted V (an
 *   over-approximation of unfinalized references).
 *
 * A value is removable exactly when both counts reach zero.
 */
export class ValueRefs {
  constructor(
    private readonly finalized: CountStore,
    private readonly pending: CountStore,
    private readonly deltas: DeltaStore,
    private readonly values: ValueStore,
  ) {}

  /** Record values referenced by the genesis / initial finalized state. */
  onInitial(inserted: ValueHash[]): void {
    for (const v of inserted) {
      this.inc(this.finalized, v);
    }
  }

  /** Record a freshly imported, not-yet-finalized block. */
  onImport(header: HeaderHash, delta: ValueDelta): void {
    this.deltas.set(header, delta);
    for (const v of delta.inserted) {
      this.inc(this.pending, v);
    }
  }

  /**
   * Apply the value deltas of newly finalized blocks, in finalized (ancestor-first) order.
   *
   * Moves each inserted value from `pending` to `finalized`, drops `finalized`
   * references for removed values, and collects anything that becomes unreferenced.
   */
  commitFinalized(headers: HeaderHash[]): void {
    for (const header of headers) {
      const delta = this.deltas.get(header);
      if (delta === undefined) {
        // already committed, or not tracked (e.g. genesis)
        continue;
      }
      for (const v of delta.inserted) {
        this.inc(this.finalized, v);
        this.dec(this.pending, v);
      }
      for (const v of delta.removed) {
        this.dec(this.finalized, v);
        this.maybeDelete(v);
      }
      this.deltas.delete(header);
    }
  }

  /**
   * Release the speculative references of a state being discarded.
   *
   * Returns `true` if the header was still unfinalized (a dead fork), in which
   * case its inserted values are unreferenced and may be collected. Returns
   * `false` for an already finalized state, whose delta was consumed on finality
   * and whose values are accounted for in `finalized`.
   */
  releaseUnfinalized(header: HeaderHash): boolean {
    const delta = this.deltas.get(header);
    if (delta === undefined) {
      return false;
    }
    for (const v of delta.inserted) {
      this.dec(this.pending, v);
      this.maybeDelete(v);
    }
    this.deltas.delete(header);
    return true;
  }

  private inc(store: CountStore, v: ValueHash): void {
    store.set(v, store.get(v) + 1);
  }

  private dec(store: CountStore, v: ValueHash): void {
    const next = store.get(v) - 1;
    if (next <= 0) {
      store.delete(v);
    } else {
      store.set(v, next);
    }
  }

  private maybeDelete(v: ValueHash): void {
    if (this.finalized.get(v) === 0 && this.pending.get(v) === 0) {
      this.values.delete(v);
    }
  }
}
