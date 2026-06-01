export function isBrowser() {
  return typeof process === "undefined" || typeof process.abort === "undefined";
}

/**
 * Get current time in milliseconds (works in both Node and browser).
 *
 * Node.js implementation converts hrtime bigint nanoseconds to milliseconds.
 * This is safe because dividing nanoseconds by 1_000_000 yields milliseconds,
 * which remain well below Number.MAX_SAFE_INTEGER for practical runtimes
 * (would take ~285 years to overflow).
 */
export const now = isBrowser() ? () => performance.now() : () => Number(process.hrtime.bigint() / 1_000_000n);

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
  return inspectInternal(val, new WeakSet());
}

/**
 * Internal implementation of inspect with circular reference detection.
 */
function inspectInternal<T>(val: T, seen: WeakSet<object>): string {
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
    return `[${val.map((x) => inspectInternal(x, seen))}]`;
  }

  if (val instanceof Map) {
    return inspectInternal(Array.from(val.entries()), seen);
  }

  if (typeof val === "number") {
    return `${val} (0x${val.toString(16)})`;
  }

  if (typeof val !== "object") {
    return `${val}`;
  }

  // Check for circular references
  if (seen.has(val)) {
    return "<circular>";
  }
  seen.add(val);

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
      v += `${k}: ${nest(inspectInternal(val[k as keyof T], seen))}`;
      v += oneLine ? "," : "";
    }
  }
  v += oneLine ? "}" : "\n}";
  return v;
}

/**
 * Utility function to measure time taken for some operation [ms].
 *
 * To reduce allocations, each timer can only track one entry.
 *
 */
export function measure(id: string) {
  const response = {
    id,
    start: 0,
    duration() {
      return now() - this.start;
    },
    toString() {
      return `${this.id} took ${(this.duration()).toFixed(2)}ms`;
    },
  };

  return () => {
    response.start = now();
    return response;
  };
}

const BYTES_IN_MB = 1024 * 1024;
const toMb = (bytes: number) => (bytes / BYTES_IN_MB).toFixed(1);
const signedMb = (bytes: number) => `${bytes >= 0 ? "+" : ""}${toMb(bytes)}`;

/** Raw process memory usage, or `null` in environments without `process` (e.g. browser). */
function rawMemoryUsage(): NodeJS.MemoryUsage | null {
  if (isBrowser() || typeof process.memoryUsage !== "function") {
    return null;
  }
  return process.memoryUsage();
}

/**
 * Format current process memory usage as a human readable string.
 *
 * Returns an empty string in the browser where `process.memoryUsage` is unavailable.
 *
 * `arrayBuffers` should allow tracking WASM memory, since every instance backs its
 * memory with `ArrayBuffer`.
 */
export function memoryUsage(): string {
  const m = rawMemoryUsage();
  if (m === null) {
    return "";
  }
  return `rss=${toMb(m.rss)}MB heap=${toMb(m.heapUsed)}/${toMb(m.heapTotal)}MB external=${toMb(m.external)}MB arrayBuffers=${toMb(m.arrayBuffers)}MB`;
}

/** Create a stateful memory usage reporter. */
export function memoryTracker(): () => string {
  let prev: NodeJS.MemoryUsage | null = null;
  return () => {
    const m = rawMemoryUsage();
    if (m === null) {
      return "";
    }
    const delta =
      prev === null
        ? ""
        : ` (Δrss=${signedMb(m.rss - prev.rss)}MB ΔarrayBuffers=${signedMb(m.arrayBuffers - prev.arrayBuffers)}MB)`;
    prev = m;
    return `${memoryUsage()}${delta}`;
  };
}

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
