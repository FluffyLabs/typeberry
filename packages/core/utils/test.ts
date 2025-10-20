/**
 * Utilities for tests.
 */
import assert from "node:assert";
import { inspect } from "./debug.js";
import type { Result } from "./result.js";

/**
 * If some object has this property set, it can override how it's being compared
 * using [`deepEqual`].
 * The value under that symbol should be a function to be invoked by `deepEqual`.
 * Returned values will then be further compared recursively.
 */
export const TEST_COMPARE_USING: unique symbol = Symbol("compare using");

function callCompareFunction(object: unknown) {
  if (object !== null && typeof object === "object" && TEST_COMPARE_USING in object) {
    if (typeof object[TEST_COMPARE_USING] !== "function") {
      throw new Error(`${String(TEST_COMPARE_USING)} of ${object} is not a function!`);
    }
    return object[TEST_COMPARE_USING]();
  }

  return object;
}

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

let oomWarningPrinted = false;

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
      /**
       * There is a problem with memory in node 22.12.0+
       *
       * This workaround can be removed when this issue is resolved: https://github.com/nodejs/node/issues/57242
       */
      const [major, minor] = process.versions.node.split(".").map(Number);
      const isOoMWorkaroundNeeded = major > 22 || (major === 22 && minor >= 12);
      const message = isOoMWorkaroundNeeded ? new Error(`${actual} != ${expected}`) : undefined;
      const actualDisp = actual === null || actual === undefined ? actual : `${inspect(actual)}`;
      const expectedDisp = expected === null || expected === undefined ? expected : `${inspect(expected)}`;

      try {
        assert.strictEqual(actualDisp, expectedDisp, message);
      } catch (e) {
        if (isOoMWorkaroundNeeded && !oomWarningPrinted) {
          // biome-ignore lint/suspicious/noConsole: warning
          console.warn(
            [
              "Stacktrace may be crappy because of a problem in nodejs.",
              "Use older version than 22.12.0 or check this issue: https://github.com/nodejs/node/issues/57242",
              "Maybe we do not need it anymore",
            ].join("\n"),
          );
          oomWarningPrinted = true;
        }
        throw e;
      }
    }, ctx);
    return errors.exitOrThrow();
  }

  // special casing for customized comparison
  if (
    (typeof actual === "object" && TEST_COMPARE_USING in actual) ||
    (typeof expected === "object" && TEST_COMPARE_USING in expected)
  ) {
    deepEqual(callCompareFunction(actual), callCompareFunction(expected), {
      context: ctx,
      errorsCollector: errors,
      ignore,
    });
    return errors.exitOrThrow();
  }

  if (isResult(actual) && isResult(expected)) {
    if (actual.isOk && !expected.isOk) {
      errors.tryAndCatch(() => {
        throw new Error(`Got OK, expected ERROR: ${expected.error}: ${expected.details}`);
      }, ctx);
    }

    if (!actual.isOk && expected.isOk) {
      errors.tryAndCatch(() => {
        throw new Error(`Expected OK, Got ERROR: ${actual.error}: ${actual.details}`);
      }, ctx);
    }

    if (actual.isOk && expected.isOk) {
      deepEqual(actual.ok, expected.ok, { context: ctx.concat(["ok"]), errorsCollector: errors, ignore });
    }

    if (actual.isError && expected.isError) {
      deepEqual(actual.error, expected.error, { context: ctx.concat(["error"]), errorsCollector: errors, ignore });
      deepEqual(actual.details(), expected.details(), {
        context: ctx.concat(["details"]),
        errorsCollector: errors,
        // display details when error does not match
        ignore: actual.error === expected.error ? ignore : [],
      });
    }
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

  // special casing for maps
  if (actual instanceof Map && expected instanceof Map) {
    const toArray = (input: Map<unknown, unknown>): Array<{ key: unknown; value: unknown }> => {
      return Array.from(input.entries())
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => {
          const aKey = `${a.key}`;
          const bKey = `${b.key}`;

          if (aKey < bKey) {
            return -1;
          }
          if (bKey < aKey) {
            return 1;
          }
          return 0;
        });
    };

    deepEqual(toArray(actual), toArray(expected), {
      context: ctx.concat(["[map]"]),
      errorsCollector: errors,
      ignore,
    });
    return errors.exitOrThrow();
  }

  if (typeof actual === "object" && typeof expected === "object") {
    const actualKeys = Object.keys(actual) as (keyof T)[];
    const expectedKeys = Object.keys(expected) as (keyof T)[];
    actualKeys.sort();
    expectedKeys.sort();

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
        if (context.length > 0) {
          e.stack = `${preamble}${e.stack}`;
        }
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

function isResult(x: unknown): x is Result<unknown, unknown> {
  return (
    x !== null &&
    typeof x === "object" &&
    "isOk" in x &&
    "isError" in x &&
    typeof x.isOk === "boolean" &&
    typeof x.isError === "boolean"
  );
}
