import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";

const SUPER_PEAK_STRING = BytesBlob.blobFromString("$node");

/** Merkle Mountain Range peaks. */
export interface MmrPeaks<H extends OpaqueHash> {
  /**
   * Peaks at particular positions.
   *
   * In case there is no merkle trie at given index, `null` is placed.
   */
  peaks: (H | null)[];
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
 * https://graypaper.fluffylabs.dev/#/579bd12/3aa0023aa002
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
          if (peak) {
            acc.push(Mountain.fromPeak(hasher, peak, 2 ** index));
          }
          return acc;
        }, [])
        .reverse(),
    );
  }

  private constructor(
    private readonly hasher: MmrHasher<H>,
    /** Store non-empty merkle tries (mountains) ordered by ascending size. */
    private readonly mountains: Mountain<H>[] = [],
  ) {}

  /** Append a new hash to the MMR structure. */
  append(hash: H) {
    let newMountain = Mountain.fromPeak(this.hasher, hash, 1);

    for (;;) {
      const last = this.mountains.pop();
      if (!last) {
        this.mountains.push(newMountain);
        return;
      }

      if (last.size !== newMountain.size) {
        this.mountains.push(last);
        this.mountains.push(newMountain);
        return;
      }

      newMountain = last.mergeWith(newMountain);
    }
  }

  /** Root of the entire structure. */
  getSuperPeakHash(): H {
    if (this.mountains.length === 0) {
      return Bytes.zero(HASH_SIZE).asOpaque();
    }
    let lastHash = this.mountains[0].peak;
    const length = this.mountains.length;
    for (let i = 1; i < length; i++) {
      const mountain = this.mountains[i];
      lastHash = this.hasher.hashConcatPrepend(SUPER_PEAK_STRING, lastHash, mountain.peak);
    }
    return lastHash;
  }

  /** Get current peaks. */
  getPeaks(): MmrPeaks<H> {
    const ret: MmrPeaks<H> = { peaks: [] };
    const mountains = this.mountains;

    // always 2**index
    let currentSize = 1;
    let currentIdx = mountains.length - 1;
    while (currentIdx >= 0) {
      const currentItem = mountains[currentIdx];
      if (currentItem.size >= currentSize && currentItem.size < 2 * currentSize) {
        ret.peaks.push(currentItem.peak);
        currentIdx -= 1;
      } else {
        ret.peaks.push(null);
      }
      // move to the next index.
      currentSize = currentSize << 1;
    }
    return ret;
  }
}

/** An internal helper structure to represent a merkle trie for MMR. */
class Mountain<H extends OpaqueHash> {
  public readonly hasher: MmrHasher<H>;
  public readonly size: number;
  public readonly peak: H;

  static fromPeak<H extends OpaqueHash>(hasher: MmrHasher<H>, peak: H, size: number) {
    return new Mountain(hasher, peak, null, size);
  }

  private constructor(hasher: MmrHasher<H>, peak: H | null, children: [Mountain<H>, Mountain<H>] | null, size = 1) {
    this.hasher = hasher;

    if (peak !== null) {
      this.peak = peak;
      this.size = size;
      return;
    }

    if (children !== null) {
      const [left, right] = children;
      this.peak = this.hasher.hashConcat(left.peak, right.peak);
      this.size = left.size + right.size;
      return;
    }

    throw new Error("Either peak or children need to be provided");
  }

  /** Merge with another montain of the same size. */
  mergeWith(other: Mountain<H>): Mountain<H> {
    return new Mountain(this.hasher, null, [this, other]);
  }
}
