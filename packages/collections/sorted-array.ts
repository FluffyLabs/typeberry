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

  /** Remove one matching element from the collection. */
  public removeOne(v: V) {
    const findIdx = this.binarySearch(v);
    if (findIdx >= this.array.length) {
      return;
    }

    const existing = this.array[findIdx];
    if (this.comparator(existing, v) !== Ordering.Equal) {
      return;
    }

    // remove the element
    this.array.splice(findIdx, 1);
  }

  /** Check if element is present in the collection. */
  public has(v: V) {
    const findIdx = this.binarySearch(v);
    if (findIdx >= this.array.length) {
      return false;
    }

    const existing = this.array[findIdx];
    return this.comparator(existing, v) === Ordering.Equal;
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
