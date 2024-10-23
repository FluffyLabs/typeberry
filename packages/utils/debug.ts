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
export function ensure<T, U extends T>(a: T, condition: boolean, message?: string): U {
  if (cast<T, U>(a, condition)) {
    return a;
  }

  throw new Error(`Assertion failure: ${message || ""}`);
}

/** A class that adds `toString` method that prints all properties of an object. */
export abstract class WithDebug {
  toString() {
    const nest = (v: string) =>
      v
        .split("\n")
        .map((x) => `  ${x}`)
        .join("\n")
        .trim();
    const asStr = (v: unknown) => {
      if (v === null) {
        return "<null>";
      }
      if (v === undefined) {
        return "<undefined>";
      }
      if (Array.isArray(v)) {
        return `[${v}]`;
      }
      return `${v}`;
    };
    let v = `${this.constructor.name} {`;
    const keys = Object.keys(this);
    const oneLine = keys.length < 3;
    for (const k of keys) {
      if (typeof k === "string") {
        v += oneLine ? "" : "\n  ";
        v += `${k}: ${nest(asStr(this[k as keyof WithDebug]))}`;
        v += oneLine ? "," : "";
      }
    }
    v += oneLine ? "}" : "\n}";
    return v;
  }
}
