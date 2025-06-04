import type { Comparator } from "@typeberry/ordering";
import { check } from "@typeberry/utils";

export interface ImmutableSortedArray<V> extends Iterable<V> {
  /** Underlying array. */
  get array(): readonly V[];
  /** Underlying comparator. */
  get comparator(): Comparator<V>;

  /**
   * Returns index of SOME (it's not guaranteed it's first or last)
   * equal element or -1 if the element does not exist.
   */
  findIndex(v: V): number;

  /**
   * Return the exact (in terms of comparator) element that's in the array if present.
   *
   * Note this API might look redundant on a first glance, but it really depends on the
   * comparator. We might have a complex object inside the array, yet the comparator
   * will consider two objects equal just by looking at the id. With this API
   * we are able to retrieve the exact object that's stored.
   */
  findExact(v: V): V | undefined;

  /** Check if element is present in the collection. */
  has(v: V): boolean;

  /** Return the number of items in the array. */
  get length(): number;

  /** Return a regular array that's a copy of this one. */
  slice(start?: number, end?: number): V[];
}

/**
 * Collection of elements of type `V` that has some strict ordering.
 *
 * The items are stored sorted, which allows logarithmic insertion & lookup
 * and obviously in-order iteration.
 *
 * Duplicates are allowed, so make sure to check presence before inserting.
 */
export class SortedArray<V> implements ImmutableSortedArray<V> {
  /**
   * Create SortedArray from array that is not sorted. This function sorts the array.
   */
  static fromArray<V>(comparator: Comparator<V>, array: readonly V[] = []) {
    const data = array.slice();
    data.sort((a, b) => comparator(a, b).value);
    return new SortedArray(data, comparator);
  }

  /**
   * Create SortedArray from array that is sorted. This function does not sort the array. Unsorted array will not work correctly!
   */
  static fromSortedArray<V>(comparator: Comparator<V>, array: readonly V[] = []) {
    const dataLength = array.length;

    if (dataLength === 0) {
      return new SortedArray([], comparator);
    }

    const data = array.slice();

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]).isGreater()) {
        throw new Error(`Expected sorted array, got: ${data}`);
      }
    }

    return new SortedArray(data, comparator);
  }

  protected constructor(
    public readonly array: V[],
    public readonly comparator: Comparator<V>,
  ) {}

  /** Insert new element to the collection. */
  public insert(v: V) {
    const findIdx = this.binarySearch(v);
    this.array.splice(findIdx.idx, 0, v);
  }

  /**
   * Return and remove the last element of the collection.
   *
   * `shift` is much slower, so please don't add it.
   */
  public pop(): V | undefined {
    return this.array.pop();
  }

  public findIndex(v: V) {
    const findIdx = this.binarySearch(v);
    if (findIdx.isEqual) {
      return findIdx.idx;
    }

    return -1;
  }

  public findExact(v: V): V | undefined {
    const findIdx = this.binarySearch(v);
    if (findIdx.isEqual) {
      return this.array[findIdx.idx];
    }

    return undefined;
  }

  /** Remove one matching element from the collection. */
  public removeOne(v: V) {
    const findIdx = this.binarySearch(v);
    if (findIdx.isEqual) {
      // remove the element
      this.array.splice(findIdx.idx, 1);
    }
  }

  public has(v: V) {
    return this.binarySearch(v).isEqual;
  }

  public get length(): number {
    return this.array.length;
  }

  /** Return a regular array that's a copy of this one. */
  public slice(start?: number, end?: number): V[] {
    return this.array.slice(start, end);
  }

  protected binarySearch(v: V) {
    const arr = this.array;
    const cmp = this.comparator;

    let low = 0;
    let high = arr.length;

    while (low < high) {
      const mid = (high + low) >> 1;
      const r = cmp(arr[mid], v);
      if (r.isEqual()) {
        return {
          idx: mid,
          isEqual: true,
        };
      }

      if (r.isLess()) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return {
      idx: low,
      isEqual: false,
    };
  }

  /** Create a new SortedSet from two sorted collections. */
  static fromTwoSortedCollections<V>(first: ImmutableSortedArray<V>, second: ImmutableSortedArray<V>) {
    check(first.comparator === second.comparator, "Cannot merge arrays if they do not use the same comparator");
    const comparator = first.comparator;
    const arr1 = first.array;
    const arr1Length = arr1.length;
    const arr2 = second.array;
    const arr2Length = arr2.length;

    const resultLength = arr1Length + arr2Length;
    const result: V[] = new Array(resultLength);

    let i = 0; // arr1 index
    let j = 0; // arr2 index
    let k = 0; // result array index

    while (i < arr1Length && j < arr2Length) {
      if (comparator(arr1[i], arr2[j]).isLess()) {
        result[k++] = arr1[i++];
      } else if (comparator(arr1[i], arr2[j]).isGreater()) {
        result[k++] = arr2[j++];
      } else {
        result[k++] = arr1[i++];
        result[k++] = arr2[j++];
      }
    }

    while (i < arr1Length) {
      result[k++] = arr1[i++];
    }

    while (j < arr2Length) {
      result[k++] = arr2[j++];
    }

    return SortedArray.fromSortedArray(comparator, result);
  }

  /** it allows to use SortedArray in for-of loop */
  *[Symbol.iterator]() {
    for (const value of this.array) {
      yield value;
    }
  }
}
