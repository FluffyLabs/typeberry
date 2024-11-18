import { type Comparator, Ordering, SortedArray } from "./sorted-array";

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
    return new SortedSet(data, comparator);
  }

  /**
   * Create SortedSet from array that is sorted. This function does not sort the array. Unsorted array will not work correctly!
   */
  static fromSortedArray<V>(comparator: Comparator<V>, array: V[] = []) {
    if (array.length === 0) {
      return new SortedSet([], comparator);
    }

    const data = array.slice();
    const dataLength = data.length;

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]) !== Ordering.Less) {
        throw new Error("Array is not sorted or contains duplicates!");
      }
    }

    return new SortedSet(data, comparator);
  }

  /** Insert new element to the collection if not exist. */
  public insert(v: V) {
    const findIdx = this.binarySearch(v);
    const maybeItem = this.array[findIdx];
    if (!maybeItem || this.comparator(this.array[findIdx], v) !== Ordering.Equal) {
      this.array.splice(findIdx, 0, v);
    }
  }
}
