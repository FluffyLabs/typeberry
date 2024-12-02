import type { SortedArray } from "./sorted-array";
import type { SortedSet } from "./sorted-set";

export type SortedCollection<V> = SortedSet<V> | SortedArray<V>;
