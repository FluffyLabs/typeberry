import type { HeaderHash } from "@typeberry/block";
import { HashDictionary } from "@typeberry/collections";
import type { ValueHash } from "@typeberry/trie";

/** The value hashes a single block introduced and stopped referencing. */
export interface ValueDelta {
  /** Value hashes (non-embedded) that the block started referencing. */
  inserted: ValueHash[];
  /** Value hashes (non-embedded) that the block stopped referencing. */
  removed: ValueHash[];
}

/**
 * Synchronous, read-only view of the persisted refcounting state.
 *
 * Both LMDB and fjall offer synchronous reads, so reads can go straight
 * to the backing store. All writes go through `ValueRefsUpdate` batches
 * instead, since persistent backends can only write asynchronously
 * (LMDB transactions, fjall inserts + persist).
 */
export interface ValueRefsReader {
  /** How many leaves of the finalized-tip state reference the value. Missing keys read as `0`. */
  getFinalizedCount(hash: ValueHash): number;
  /** How many surviving, not-yet-finalized blocks inserted the value. Missing keys read as `0`. */
  getPendingCount(hash: ValueHash): number;
  /** The value delta of a not-yet-finalized block, if known. */
  getDelta(header: HeaderHash): ValueDelta | undefined;
}

/**
 * A batch of refcounting mutations produced by a single `ValueRefs` operation.
 *
 * The backend is responsible for applying the batch using its own write
 * primitive - ideally atomically with the state write that triggered it
 * (one LMDB transaction, one fjall persist).
 *
 * Counts are absolute values rather than increments, so applying the same
 * update more than once (e.g. on crash-replay) is harmless.
 *
 * When atomicity is not available, apply in field order and `removeValues`
 * strictly last: a crash after counts are persisted but before values are
 * removed only leaks values, while the opposite order could drop a value
 * the persisted counts still consider referencd.
 */
export interface ValueRefsUpdate {
  /** New absolute finalized counts. Count `0` means the entry should be removed. */
  finalizedCounts: [ValueHash, number][];
  /** New absolute pending counts. Count `0` means the entry should be removed. */
  pendingCounts: [ValueHash, number][];
  /** Deltas of freshly imported blocks to persist. */
  setDeltas: [HeaderHash, ValueDelta][];
  /** Deltas consumed by finalization or fork pruning. */
  removeDeltas: HeaderHash[];
  /** Values that are no longer referenced and can be removed from the values DB. */
  removeValues: ValueHash[];
}

/** `true` if applying the update would not change anything. */
export function isEmptyUpdate(update: ValueRefsUpdate): boolean {
  return (
    update.finalizedCounts.length === 0 &&
    update.pendingCounts.length === 0 &&
    update.setDeltas.length === 0 &&
    update.removeDeltas.length === 0 &&
    update.removeValues.length === 0
  );
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
 *
 * This class only makes decisions: every operation reads the current state
 * through `ValueRefsReader` and returns a `ValueRefsUpdate` describing what
 * should change. Nothing is written here - the owning backend applies the
 * update with whatever consistency guarantees it can provide.
 */
export class ValueRefs {
  constructor(private readonly reader: ValueRefsReader) {}

  /** Record values referenced by the genesis / initial finalized state. */
  onInitial(inserted: ValueHash[]): ValueRefsUpdate {
    const update = new UpdateBuilder(this.reader);
    for (const v of inserted) {
      update.incFinalized(v);
    }
    return update.build();
  }

  /**
   * Record a freshly imported, not-yet-finalized block.
   *
   * Importing the same header twice is a no-op, otherwise the second import
   * would double-count `pending` references and pin the values forever.
   */
  onImport(header: HeaderHash, delta: ValueDelta): ValueRefsUpdate {
    const update = new UpdateBuilder(this.reader);
    if (update.getDelta(header) !== undefined) {
      return update.build();
    }
    update.setDelta(header, delta);
    for (const v of delta.inserted) {
      update.incPending(v);
    }
    return update.build();
  }

  /**
   * Apply the value deltas of newly finalized blocks, in finalized (ancestor-first) order.
   *
   * Moves each inserted value from `pending` to `finalized`, drops `finalized`
   * references for removed values, and collects anything that becomes unreferenced.
   */
  commitFinalized(headers: HeaderHash[]): ValueRefsUpdate {
    const update = new UpdateBuilder(this.reader);
    for (const header of headers) {
      const delta = update.getDelta(header);
      if (delta === undefined) {
        // already committed, or not tracked (e.g. genesis)
        continue;
      }
      for (const v of delta.inserted) {
        update.incFinalized(v);
        update.decPending(v);
      }
      for (const v of delta.removed) {
        update.decFinalized(v);
      }
      update.removeDelta(header);
    }
    return update.build();
  }

  /**
   * Release the speculative references of a state being discarded.
   *
   * For a header that was still unfinalized (a dead fork) the returned update
   * releases its inserted values, which may become collectable. For an already
   * finalized state the update is empty (check with `isEmptyUpdate`): its delta
   * was consumed on finality and its values are accounted for in `finalized`.
   */
  releaseUnfinalized(header: HeaderHash): ValueRefsUpdate {
    const update = new UpdateBuilder(this.reader);
    const delta = update.getDelta(header);
    if (delta === undefined) {
      return update.build();
    }
    for (const v of delta.inserted) {
      update.decPending(v);
    }
    update.removeDelta(header);
    return update.build();
  }
}

/**
 * Accumulates mutations of a single operation as an overlay over the reader,
 * so that later steps observe earlier ones (e.g. several blocks finalized at once).
 */
class UpdateBuilder {
  private readonly finalized: HashDictionary<ValueHash, number> = HashDictionary.new();
  private readonly pending: HashDictionary<ValueHash, number> = HashDictionary.new();
  private readonly setDeltas: HashDictionary<HeaderHash, ValueDelta> = HashDictionary.new();
  private readonly removedDeltas: HashDictionary<HeaderHash, HeaderHash> = HashDictionary.new();
  /** Values that lost a reference and may need removal - verified against final counts in `build`. */
  private readonly removalCandidates: HashDictionary<ValueHash, ValueHash> = HashDictionary.new();

  constructor(private readonly reader: ValueRefsReader) {}

  getDelta(header: HeaderHash): ValueDelta | undefined {
    if (this.removedDeltas.has(header)) {
      return undefined;
    }
    return this.setDeltas.get(header) ?? this.reader.getDelta(header);
  }

  setDelta(header: HeaderHash, delta: ValueDelta): void {
    this.setDeltas.set(header, delta);
  }

  removeDelta(header: HeaderHash): void {
    this.removedDeltas.set(header, header);
  }

  incFinalized(v: ValueHash): void {
    this.finalized.set(v, this.getFinalized(v) + 1);
  }

  decFinalized(v: ValueHash): void {
    this.finalized.set(v, Math.max(0, this.getFinalized(v) - 1));
    this.removalCandidates.set(v, v);
  }

  incPending(v: ValueHash): void {
    this.pending.set(v, this.getPending(v) + 1);
  }

  decPending(v: ValueHash): void {
    this.pending.set(v, Math.max(0, this.getPending(v) - 1));
    this.removalCandidates.set(v, v);
  }

  build(): ValueRefsUpdate {
    const removeValues: ValueHash[] = [];
    for (const v of this.removalCandidates.values()) {
      if (this.getFinalized(v) === 0 && this.getPending(v) === 0) {
        removeValues.push(v);
      }
    }
    return {
      finalizedCounts: Array.from(this.finalized),
      pendingCounts: Array.from(this.pending),
      setDeltas: Array.from(this.setDeltas),
      removeDeltas: Array.from(this.removedDeltas.keys()),
      removeValues,
    };
  }

  private getFinalized(v: ValueHash): number {
    return this.finalized.get(v) ?? this.reader.getFinalizedCount(v);
  }

  private getPending(v: ValueHash): number {
    return this.pending.get(v) ?? this.reader.getPendingCount(v);
  }
}

/**
 * In-memory refcounting store, reusable by the in-memory and hybrid states DBs
 * (the hybrids cannot resume from disk anyway, so persisting counts buys nothing).
 *
 * NOTE: `apply` does not touch the values DB - the caller owns it and must
 * handle `update.removeValues` itself.
 */
export class InMemoryValueRefsStore implements ValueRefsReader {
  private readonly finalized: HashDictionary<ValueHash, number> = HashDictionary.new();
  private readonly pending: HashDictionary<ValueHash, number> = HashDictionary.new();
  private readonly deltas: HashDictionary<HeaderHash, ValueDelta> = HashDictionary.new();

  getFinalizedCount(hash: ValueHash): number {
    return this.finalized.get(hash) ?? 0;
  }

  getPendingCount(hash: ValueHash): number {
    return this.pending.get(hash) ?? 0;
  }

  getDelta(header: HeaderHash): ValueDelta | undefined {
    return this.deltas.get(header);
  }

  apply(update: ValueRefsUpdate): void {
    applyCounts(this.finalized, update.finalizedCounts);
    applyCounts(this.pending, update.pendingCounts);
    for (const [header, delta] of update.setDeltas) {
      this.deltas.set(header, delta);
    }
    for (const header of update.removeDeltas) {
      this.deltas.delete(header);
    }
  }
}

function applyCounts(store: HashDictionary<ValueHash, number>, counts: [ValueHash, number][]): void {
  for (const [hash, count] of counts) {
    if (count === 0) {
      store.delete(hash);
    } else {
      store.set(hash, count);
    }
  }
}
