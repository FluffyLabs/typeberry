import type { Judgement } from "@typeberry/block/disputes";
import type { BytesBlob } from "@typeberry/bytes";

/**
 * A function that checks if an array of object is ascending sorted by key that is BytesBlob and there is no duplicates
 */
export function isUniqueSortedBy<T extends Record<K, BytesBlob>, K extends keyof T>(arr: T[], key: K) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1][key].compare(arr[i][key]).isGreaterOrEqual()) {
      return false;
    }
  }

  return true;
}

/**
 * A function that checks if an array of Judgements is ascending sorted by index and there is no duplicates
 */
export function isUniqueSortedByIndex(judgements: Judgement[]) {
  for (let i = 1; i < judgements.length; i++) {
    if (judgements[i - 1].index >= judgements[i].index) {
      return false;
    }
  }

  return true;
}
