/**
 * Utilities for tests.
 */
import assert from "node:assert";

/** Unique symbol that can be added to a class to have it be compared by strings instead of defaults. */
export const TEST_COMPARE_VIA_STRING: unique symbol = Symbol("compare via string");

/** Equality comparison options. */
export type DeepEqualOptions = {
  /** Initial context, i.e. name of the variable we are comparing. */
  context?: string | string[];
  /** A list of ignored paths (for instance `result.details`). */
  ignore?: string[];
  /**
   * Optional shared errors collector.
   * It can be used to run multiple assertions instead of failing on the first one.
   */
  errorsCollector?: ErrorsCollector;
};

/** Deeply compare `actual` and `expected` values. */
export function deepEqual<T>(
  actual: T | undefined,
  expected: T | undefined,
  { context = [], errorsCollector, ignore = [] }: DeepEqualOptions = {},
) {
  const ctx = Array.isArray(context) ? context : [context];
  const errors = errorsCollector ?? new ErrorsCollector();

  // ignore a field if it's on ignore list.
  if (ignore.includes(ctx.join("."))) {
    return;
  }

  errors.enter();

  if (actual === null || expected === null || actual === undefined || expected === undefined) {
    errors.tryAndCatch(() => {
      assert.strictEqual(actual, expected);
    }, ctx);
    return errors.exitOrThrow();
  }

  // special casing for bytes blobs
  if (
    (typeof actual === "object" && TEST_COMPARE_VIA_STRING in actual) ||
    (typeof expected === "object" && TEST_COMPARE_VIA_STRING in expected)
  ) {
    errors.tryAndCatch(() => {
      deepEqual(actual.toString(), expected.toString());
    }, ctx);
    return errors.exitOrThrow();
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    errors.tryAndCatch(() => {
      if (actual.length !== expected.length) {
        throw new Error(`Invalid array length: ${actual.length} !== ${expected.length} ${ctx.join(".")}`);
      }
    }, ctx);

    const len = Math.max(actual.length, expected.length);
    for (let i = 0; i < len; i++) {
      deepEqual(actual[i], expected[i], { context: ctx.concat([`[${i}]`]), errorsCollector: errors, ignore });
    }
    return errors.exitOrThrow();
  }

  if (typeof actual === "object" && typeof expected === "object") {
    const actualKeys = Object.keys(actual) as (keyof T)[];
    const expectedKeys = Object.keys(expected) as (keyof T)[];

    const allKeys = getAllKeysSorted<T>(actualKeys, expectedKeys);
    for (const key of allKeys) {
      deepEqual(actual[key], expected[key], { context: ctx.concat([String(key)]), errorsCollector: errors, ignore });
    }

    deepEqual(actualKeys, expectedKeys, { context: ctx.concat(["[keys]"]), errorsCollector: errors, ignore });
    return errors.exitOrThrow();
  }

  errors.tryAndCatch(() => {
    // fallback
    assert.strictEqual(actual, expected);
  }, ctx);

  return errors.exitOrThrow();
}

function getAllKeysSorted<T>(a: (keyof T)[], b: (keyof T)[]): (keyof T)[] {
  const all = new Set(a.concat(b));
  return Array.from(all).sort();
}

/** Attempt to invoke assertions and catch any errors. */
export class ErrorsCollector {
  readonly errors: { context: string[]; e: unknown }[] = [];
  private nested = 0;

  /** We are going into a nested context, so calling `exitOrThrow` will not throw. */
  enter() {
    this.nested += 1;
  }

  /** Execute the closure and catch any errors that may occur. */
  tryAndCatch(cb: () => void, context: string[]) {
    try {
      cb();
    } catch (e) {
      this.errors.push({ context, e });
    }
  }

  /** Exit the previously entered nested context or throw collected errors if we are in top-level context. */
  exitOrThrow() {
    this.nested -= 1;

    // don't throw any errors if we are just collecting errors from a nested context.
    if (this.nested > 0) {
      return this;
    }

    if (this.errors.length === 0) {
      return this;
    }

    const addContext = (e: unknown, context: string[]) => {
      const preamble = `❌  DATA MISMATCH @ ${context.join(".")}\n`;
      if (e instanceof Error) {
        e.stack = `${preamble}${e.stack}`;
        return e;
      }
      return new Error(`${preamble}${e}`);
    };

    if (this.errors.length === 1) {
      const { context, e } = this.errors[0];
      throw addContext(e, context);
    }

    const noOfErrors = this.errors.length;
    const stack = this.errors
      .map(({ context, e }) => addContext(e, context))
      .map((e, idx) => `===== ${idx + 1}/${noOfErrors} =====\n ${idx !== 0 ? trimStack(e.stack) : e.stack}`)
      .join("\n");

    const e = new Error();
    e.stack = stack;
    throw e;
  }
}

function trimStack(stack = "") {
  const firstAt = /([\s\S]+?)\s+at /;
  const res = stack.match(firstAt);
  if (res !== null) {
    return res[1];
  }
  return stack;
}
