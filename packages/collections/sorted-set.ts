import { type Comparator, Ordering, SortedArray } from "./sorted-array";

export class SortedSet<V> extends SortedArray<V> {
  static fromArray<V>(comparator: Comparator<V>, array: V[] = []) {
    const data = array.slice();
    data.sort(comparator);
    return new SortedSet(data, comparator);
  }

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
