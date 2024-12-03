import { check } from "@typeberry/utils";
import { type Comparator, Ordering, SortedArray } from "./sorted-array";
import type { SortedCollection } from "./sorted-collection";

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
    data.sort(comparator);
    const dataLength = data.length;

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]) !== Ordering.Less) {
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
      if (comparator(data[i - 1], data[i]) !== Ordering.Less) {
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
  static fromTwoSortedCollections<V>(first: SortedCollection<V>, second: SortedCollection<V>) {
    check(first.comparator === second.comparator, "Cannot merge arrays if they do not use the same comparator");
    const comparator = first.comparator;
    const arr1 = first.array;
    const arr1Length = arr1.length;
    const arr2 = second.array;
    const arr2Length = arr2.length;
    let i = 0;
    let j = 0;
    const result: V[] = [];

    const pushIfNotEqual = (lastItem: V | undefined, itemToPush: V) => {
      if (!lastItem || comparator(lastItem, itemToPush) !== Ordering.Equal) {
        result.push(itemToPush);
      }
    };

    while (i < arr1Length && j < arr2Length) {
      if (comparator(arr1[i], arr2[j]) === Ordering.Less) {
        pushIfNotEqual(result[result.length - 1], arr1[i]);
        i++;
      } else if (comparator(arr1[i], arr2[j]) === Ordering.Greater) {
        pushIfNotEqual(result[result.length - 1], arr2[j]);
        j++;
      } else {
        pushIfNotEqual(result[result.length - 1], arr1[i]);
        i++;
        j++;
      }
    }

    while (i < arr1Length) {
      pushIfNotEqual(result[result.length - 1], arr1[i]);
      i++;
    }

    while (j < arr2Length) {
      pushIfNotEqual(result[result.length - 1], arr2[j]);
      j++;
    }

    return SortedSet.fromSortedArray(comparator, result);
  }
}
