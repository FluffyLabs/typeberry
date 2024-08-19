/**
 * A function to perform runtime assertions.
 *
 * We avoid using `node:assert` to keep compatibility with a browser environment.
 * Note the checks should not have any side effects, since we might decide
 * to remove all of them in a post-processing step.
 */
export function check(condition: boolean, message?: string): asserts condition is true {
  if (!condition) {
    throw new Error(`Assertion failure: ${message || ""}`);
  }
}

function cast<T, U extends T>(a: T, condition: boolean): a is U {
  return condition;
}

/**
 * Yet another function to perform runtime assertions.
 * This function returns a new type to mark in the code that this value was checked and you don't have to do it again.
 *
 * In the post-processing step all usages of this functions should be replaced with simple casting. An example:
 * const x = checkAndType<number, CheckedNumber>(y);
 * should be replaced with:
 * const x = y as CheckedNumber;
 */
export function checkAndType<T, U extends T>(a: T, condition: boolean, message?: string): U {
  if (cast<T, U>(a, condition)) {
    return a;
  }

  throw new Error(`Assertion failure: ${message || ""}`);
}
