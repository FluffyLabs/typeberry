import type { Comparator } from "@typeberry/ordering";
import { check } from "@typeberry/utils";
import { type ImmutableSortedArray, SortedArray } from "./sorted-array.js";

export interface ImmutableSortedSet<V> extends ImmutableSortedArray<V> {}

/**
 * Collection of elements of type `V` that has some strict ordering and does not have duplicates.
 *
 * The items are stored sorted, which allows logarithmic insertion & lookup
 * and obviously in-order iteration.
 *
 * Duplicates are not allowed. Inserting an existing item is no-op.
 */
export class SortedSet<V> extends SortedArray<V> implements ImmutableSortedSet<V> {
  /**
   * Create SortedSet from array that is not sorted. This function sorts the array.
   * Duplicates are removed.
   */
  static fromArray<V>(comparator: Comparator<V>, array: readonly V[] = []) {
    if (array.length === 0) {
      return new SortedSet([], comparator);
    }

    const data = array.toSorted((a, b) => comparator(a, b).value);
    const dataLength = data.length;

    const nonDuplicates = [data[0]];
    for (let i = 1; i < dataLength; i++) {
      if (!comparator(data[i - 1], data[i]).isEqual()) {
        nonDuplicates.push(data[i]);
      }
    }

    return new SortedSet(nonDuplicates, comparator);
  }

  /**
   * Create SortedSet from array that is not sorted. This function sorts the array.
   * Duplicates are detected an are not allowed.
   */
  static fromArrayUnique<V>(comparator: Comparator<V>, array: readonly V[]) {
    const data = array.toSorted((a, b) => comparator(a, b).value);
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
  static fromSortedArray<V>(comparator: Comparator<V>, array: readonly V[] = []) {
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

  /**
   * Insert given element to the sorted set EVEN IF it's already present.
   *
   * Putting another value that's equal via comparator will replace the current one.
   */
  public replace(v: V) {
    const findIdx = this.binarySearch(v);
    const toRemove = findIdx.isEqual ? 1 : 0;
    this.array.splice(findIdx.idx, toRemove, v);
  }

  /** Create a new SortedSet from two sorted collections. */
  static fromTwoSortedCollections<V>(first: ImmutableSortedArray<V>, second: ImmutableSortedArray<V>) {
    check`${first.comparator === second.comparator} Cannot merge arrays if they do not use the same comparator`;
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
