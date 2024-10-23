/** A return value of some comparator. */
export enum Ordering {
  /** `self < other` */
  Less = -1,
  /** `self === other` */
  Equal = 0,
  /** `self > other` */
  Greater = 1,
}

/**
 * A type that compares the `self` value to `other` and returns an ordering in respect to `self`.
 *
 * e.g. `self < other => Ordering.Less`, `self > other => Ordering.Greater`
 */
export type Comparator<V> = (self: V, other: V) => Ordering;

/**
 * Collection of elements of type `V` that has some strict ordering.
 *
 * The items are stored sorted, which allows logarithmic insertion & lookup
 * and obviously in-order iteration.
 *
 * Duplicates are allowed, so make sure to check presence before inserting.
 */
export class SortedArray<V> {
  private readonly array: V[];
  private readonly comparator: Comparator<V>;

  constructor(comparator: Comparator<V>, data: V[] = []) {
    this.array = data.slice();
    this.array.sort(comparator);
    this.comparator = comparator;
  }

  /** Insert new element to the collection. */
  public insert(v: V) {
    const findIdx = this.binarySearch(v);
    this.array.splice(findIdx, 0, v);
  }

  /** Returns index of SOME (it's not guaranteed it's first or last) element or -1 if the element does not exist */
  private findIndex(v: V) {
    const findIdx = this.binarySearch(v);
    if (findIdx >= this.array.length) {
      return -1;
    }

    const existing = this.array[findIdx];
    if (this.comparator(existing, v) === Ordering.Equal) {
      return findIdx;
    }

    return -1;
  }
  /** Return the exact element that's in the array if present. */
  public get(v: V): V | undefined {
    const findIdx = this.findIndex(v);
    return findIdx >= 0 ? this.array[findIdx] : undefined;
  }

  /** Remove one matching element from the collection. */
  public removeOne(v: V) {
    const findIdx = this.findIndex(v);
    if (findIdx >= 0) {
      // remove the element
      this.array.splice(findIdx, 1);
    }
  }

  /** Check if element is present in the collection. */
  public has(v: V) {
    return this.findIndex(v) >= 0;
  }

  /** Return the number of items in the array. */
  public get length(): number {
    return this.array.length;
  }

  /** Return a regular array that's a copy of this one. */
  public slice(start?: number, end?: number): V[] {
    return this.array.slice(start, end);
  }

  private binarySearch(v: V) {
    const cmp = this.comparator;
    let low = 0;
    let high = this.array.length;

    while (low < high) {
      const mid = (high + low) >> 1;
      const r = cmp(this.array[mid], v);
      if (r === Ordering.Equal) {
        return mid;
      }

      if (r <= Ordering.Less) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}
