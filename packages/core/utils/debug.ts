/**
 * A function to perform runtime assertions.
 *
 * We avoid using `node:assert` to keep compatibility with a browser environment.
 * Note the checks should not have any side effects, since we might decide
 * to remove all of them in a post-processing step.
 */
export function check(condition: boolean, message?: string): asserts condition is true {
  if (!condition) {
    throw new Error(`Assertion failure: ${message ?? ""}`);
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

  throw new Error(`Assertion failure: ${message ?? ""}`);
}

/**
 * The function can be used to make sure that a particular type is `never`
 * at some point in the code.
 *
 * Basically that means that all other options are exhaustively handled
 * earlier and the assertion should make sure that an unhandled case
 * is not introduced in the future.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

/** Debug print an object. */
export function inspect<T>(val: T): string {
  const nest = (v: string) =>
    v
      .split("\n")
      .map((x) => `  ${x}`)
      .join("\n")
      .trim();

  if (val === null) {
    return "<null>";
  }

  if (val === undefined) {
    return "<undefined>";
  }

  if (Array.isArray(val)) {
    return `[${val.map((x) => inspect(x))}]`;
  }

  if (val instanceof Map) {
    return inspect(Array.from(val.entries()));
  }

  if (typeof val === "number") {
    return `${val} (0x${val.toString(16)})`;
  }

  if (typeof val !== "object") {
    return `${val}`;
  }

  if (
    "toString" in val &&
    Object.prototype.toString !== val.toString &&
    WithDebug.prototype.toString !== val.toString
  ) {
    return `${val}`;
  }

  const name = val.constructor.name;
  let v = name !== "Object" ? `${name} {` : "{";
  const keys = Object.keys(val);
  const oneLine = keys.length < 3;
  for (const k of keys) {
    if (typeof k === "string") {
      v += oneLine ? "" : "\n  ";
      v += `${k}: ${nest(inspect(val[k as keyof T]))}`;
      v += oneLine ? "," : "";
    }
  }
  v += oneLine ? "}" : "\n}";
  return v;
}

/** Utility function to measure time taken for some operation [ms]. */
export const measure =
  process === undefined
    ? (id: string) => {
        const start = performance.now();
        return () => `${id} took ${performance.now() - start}ms`;
      }
    : (id: string) => {
        const start = process.hrtime.bigint();
        return () => {
          const tookNano = process.hrtime.bigint() - start;
          const tookMilli = Number(tookNano / 1_000_000n).toFixed(2);
          return `${id} took ${tookMilli}ms`;
        };
      };

/** A class that adds `toString` method that prints all properties of an object. */
export abstract class WithDebug {
  toString() {
    return inspect(this);
  }
}
