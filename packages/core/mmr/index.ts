/**
 * Merkle Mountain Range implementation.
 *
 * This module provides an implementation of Merkle Mountain Range (MMR),
 * a data structure for efficient append-only Merkle tree operations.
 *
 * @module mmr
 */
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

const SUPER_PEAK_STRING = BytesBlob.blobFromString("peak");

/** Merkle Mountain Range peaks. */
export interface MmrPeaks<H extends OpaqueHash> {
  /**
   * Peaks at particular positions.
   *
   * In case there is no merkle trie at given index, `null` is placed.
   */
  peaks: readonly (H | null)[];
}

/** Hasher interface for MMR. */
export interface MmrHasher<H extends OpaqueHash> {
  /** Hash two items together. */
  hashConcat(a: H, b: H): H;
  /** Hash two items together with extra bytes blob prepended. */
  hashConcatPrepend(id: BytesBlob, a: H, b: H): H;
}

/**
 * Merkle Mountain Range.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/3aa0023aa002?v=0.6.2
 */
export class MerkleMountainRange<H extends OpaqueHash> {
  /** Construct an empty MMR. */
  static empty<H extends OpaqueHash>(hasher: MmrHasher<H>) {
    return new MerkleMountainRange(hasher);
  }

  /** Construct a new MMR from existing peaks. */
  static fromPeaks<H extends OpaqueHash>(hasher: MmrHasher<H>, mmr: MmrPeaks<H>) {
    return new MerkleMountainRange(
      hasher,
      mmr.peaks
        .reduce((acc: Mountain<H>[], peak, index) => {
          if (peak !== null) {
            acc.push(Mountain.fromPeak(peak, 2 ** index));
          }
          return acc;
        }, [])
        .reverse(),
    );
  }

  private constructor(
    private readonly hasher: MmrHasher<H>,
    /** Store non-empty merkle tries (mountains) ordered by descending size. */
    private readonly mountains: Mountain<H>[] = [],
  ) {}

  /**
   * Append a new hash to the MMR structure.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/3b11003b1100?v=0.6.2
   */
  append(hash: H) {
    let newMountain = Mountain.fromPeak(hash, 1);

    for (;;) {
      const last = this.mountains.pop();
      if (last === undefined) {
        this.mountains.push(newMountain);
        return;
      }

      if (last.size !== newMountain.size) {
        this.mountains.push(last);
        this.mountains.push(newMountain);
        return;
      }

      newMountain = last.mergeWith(this.hasher, newMountain);
    }
  }

  /**
   * Root of the entire structure.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/3b20013b2001?v=0.6.2
   */
  getSuperPeakHash(): H {
    if (this.mountains.length === 0) {
      return Bytes.zero(HASH_SIZE).asOpaque();
    }
    const revMountains = this.mountains.slice().reverse();
    const length = revMountains.length;
    let lastHash = revMountains[0].peak;
    for (let i = 1; i < length; i++) {
      const mountain = revMountains[i];
      lastHash = this.hasher.hashConcatPrepend(SUPER_PEAK_STRING, lastHash, mountain.peak);
    }
    return lastHash;
  }

  /** Get current peaks. */
  getPeaks(): MmrPeaks<H> {
    const peaks: (H | null)[] = [];
    const mountains = this.mountains;

    // always 2**index
    let currentSize = 1;
    let currentIdx = mountains.length - 1;
    while (currentIdx >= 0) {
      const currentItem = mountains[currentIdx];
      if (currentItem.size >= currentSize && currentItem.size < 2 * currentSize) {
        peaks.push(currentItem.peak);
        currentIdx -= 1;
      } else {
        peaks.push(null);
      }
      // move to the next index.
      currentSize = currentSize << 1;
    }
    return { peaks };
  }
}

/** An internal helper structure to represent a merkle trie for MMR. */
class Mountain<H extends OpaqueHash> {
  private constructor(
    public readonly peak: H,
    public readonly size: number,
  ) {}

  static fromPeak<H extends OpaqueHash>(peak: H, size: number) {
    return new Mountain(peak, size);
  }

  static fromChildren<H extends OpaqueHash>(hasher: MmrHasher<H>, children: [Mountain<H>, Mountain<H>]) {
    const [left, right] = children;
    const peak = hasher.hashConcat(left.peak, right.peak);
    const size = left.size + right.size;
    return new Mountain(peak, size);
  }
  /** Merge with another montain of the same size. */
  mergeWith(hasher: MmrHasher<H>, other: Mountain<H>): Mountain<H> {
    return Mountain.fromChildren(hasher, [this, other]);
  }

  toString() {
    return `${this.size} @ ${this.peak}`;
  }
}
