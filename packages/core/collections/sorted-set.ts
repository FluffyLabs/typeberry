import type { Comparator } from "@typeberry/ordering";
import { check } from "@typeberry/utils";
import { SortedArray } from "./sorted-array";

/**
 * Collection of elements of type `V` that has some strict ordering and does not have dupliocates.
 *
 * The items are stored sorted, which allows logarithmic insertion & lookup
 * and obviously in-order iteration.
 *
 * Duplicates are not allowed. Inserting an existing item is no-op.
 */
export class SortedSet<V> extends SortedArray<V> {
  /**
   * Create SortedSet from array that is not sorted. This function sorts the array.
   */
  static fromArray<V>(comparator: Comparator<V>, array: V[] = []) {
    const data = array.slice();
    data.sort((a, b) => comparator(a, b).value);
    const dataLength = data.length;

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]).isEqual()) {
        throw new Error(`Expected array without duplicates, got: ${array}`);
      }
    }

    return new SortedSet(data, comparator);
  }

  /**
   * Create SortedSet from array that is sorted using given `comparator`.
   *
   * NOTE: This function does not sort the array. Unsorted array will throw an error.
   */
  static fromSortedArray<V>(comparator: Comparator<V>, array: V[] = []) {
    if (array.length === 0) {
      return new SortedSet([], comparator);
    }

    const data = array.slice();
    const dataLength = data.length;

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]).isGreaterOrEqual()) {
        throw new Error(`Expected sorted array without duplicates, got: ${data}`);
      }
    }

    return new SortedSet(data, comparator);
  }

  /** Insert given element to the sorted set unless it's already there. */
  public insert(v: V) {
    const findIdx = this.binarySearch(v);
    if (!findIdx.isEqual) {
      this.array.splice(findIdx.idx, 0, v);
    }
  }

  /** Create a new SortedSet from two sorted collections. */
  static fromTwoSortedCollections<V>(first: SortedArray<V>, second: SortedArray<V>) {
    check(first.comparator === second.comparator, "Cannot merge arrays if they do not use the same comparator");
    const comparator = first.comparator;

    if (first.length === 0) {
      return SortedSet.fromSortedArray(comparator, second.array);
    }

    if (second.length === 0) {
      return SortedSet.fromSortedArray(comparator, first.array);
    }
    const mergedArray = SortedArray.fromTwoSortedCollections(first, second).array;

    const mergedLength = mergedArray.length;

    let j = 1;
    for (let i = 1; i < mergedLength; i++) {
      if (comparator(mergedArray[i - 1], mergedArray[i]).isNotEqual()) {
        mergedArray[j++] = mergedArray[i];
      }
    }

    mergedArray.length = j;

    return SortedSet.fromSortedArray(comparator, mergedArray);
  }
}
