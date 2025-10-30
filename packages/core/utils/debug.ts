export function isBrowser() {
  return typeof process === "undefined" || typeof process.abort === "undefined";
}

/**
 * A function to perform runtime assertions.
 *
 * We avoid using `node:assert` to keep compatibility with a browser environment.
 * Note the checks should not have any side effects, since we might decide
 * to remove all of them in a post-processing step.
 *
 * NOTE the function is intended to be used as tagged template string for the performance
 * reasons.
 */
export function check(
  strings: TemplateStringsArray,
  condition: boolean,
  ...data: unknown[]
): asserts condition is true {
  if (!condition) {
    // add an empty value so that `data.length === strings.length`
    data.unshift("");
    const message = strings.map((v, index) => `${v}${data[index] ?? ""}`);
    throw new Error(`Assertion failure:${message.join("")}`);
  }
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

/**
 * The function can be used to make sure that a particular object type
 * has no keys at a certain point in the code.
 *
 * Basically that means that all other possible keys are exhaustively
 * handled earlier and the assertion should make sure that no unexpected
 * keys are introduced in the future.
 */
export function assertEmpty<T extends Record<string, never>>(value: T) {
  const keys = Object.keys(value);
  if (keys.length > 0) {
    throw new Error(`Unexpected keys: ${keys.join(", ")}`);
  }
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
export const measure = isBrowser()
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

export function lazyInspect<T>(obj: T) {
  return {
    toString() {
      return inspect(obj);
    },
  };
}
