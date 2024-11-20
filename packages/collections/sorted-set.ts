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
    const dataLength = data.length;

    for (let i = 1; i < dataLength; i++) {
      if (comparator(data[i - 1], data[i]) !== Ordering.Less) {
        throw new Error(`Expected array without duplicates, got: ${array}`);
      }
    }

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
}
