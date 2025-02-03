import assert from "node:assert";
import type { HeaderHash, TimeSlot, ValidatorData } from "@typeberry/block";
import { type AssurancesExtrinsic, assurancesExtrinsicCodec } from "@typeberry/block/assurances";
import type { WorkReport } from "@typeberry/block/work-report";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import {
  Assurances,
  AssurancesError,
  type AssurancesInput,
  type AssurancesState,
} from "@typeberry/transition/assurances";
import { Result, asOpaqueType } from "@typeberry/utils";
import { getAssurancesExtrinsicFromJson } from "./codec/assurances-extrinsic";
import { workReportFromJson } from "./codec/work-report";
import { TestAvailabilityAssignment, commonFromJson } from "./common-types";

class Input {
  assurances!: AssurancesExtrinsic;
  slot!: TimeSlot;
  parent!: HeaderHash;

  static toAssurancesInput(input: Input, chainSpec: ChainSpec): AssurancesInput {
    const encoded = Encoder.encodeObject(assurancesExtrinsicCodec, input.assurances, chainSpec);
    const assurances = Decoder.decodeObject(assurancesExtrinsicCodec.View, encoded, chainSpec);

    return {
      assurances,
      slot: input.slot,
      parentHash: input.parent,
    };
  }
}

const inputFromJson = (spec: ChainSpec): FromJson<Input> => ({
  assurances: getAssurancesExtrinsicFromJson(spec),
  slot: "number",
  parent: commonFromJson.bytes32(),
});

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(commonFromJson.validatorData),
  };

  avail_assignments!: Array<TestAvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];

  static toAssurancesState(test: TestState): AssurancesState {
    const availabilityAssignment = test.avail_assignments.map((x) => {
      return x === null ? null : TestAvailabilityAssignment.toAvailabilityAssignment(x);
    });
    const currentValidatorData = test.curr_validators;

    return {
      availabilityAssignment: asOpaqueType(availabilityAssignment),
      currentValidatorData: asOpaqueType(currentValidatorData),
    };
  }
}

enum AssurancesErrorCode {
  BAD_ATTESTATION_PARENT = "bad_attestation_parent",
  BAD_VALIDATOR_INDEX = "bad_validator_index",
  CORE_NOT_ENGAGED = "core_not_engaged",
  BAD_SIGNATURE = "bad_signature",
  NOT_SORTED_OR_UNIQUE_ASSURERS = "not_sorted_or_unique_assurers",
}

class OutputData {
  static fromJson: FromJson<OutputData> = {
    reported: json.array(workReportFromJson),
  };

  reported!: WorkReport[];
}

class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(OutputData.fromJson),
    err: json.optional("string"),
  };

  ok?: OutputData;
  err?: AssurancesErrorCode;

  static toAssurancesTransitionResult(out: Output): Result<WorkReport[], AssurancesError> {
    if (out.ok) {
      return Result.ok(out.ok.reported);
    }

    if (out.err) {
      switch (out.err) {
        case AssurancesErrorCode.BAD_ATTESTATION_PARENT:
          return Result.error(AssurancesError.InvalidAnchor);
        case AssurancesErrorCode.BAD_VALIDATOR_INDEX:
          return Result.error(AssurancesError.InvalidValidatorIndex);
        case AssurancesErrorCode.CORE_NOT_ENGAGED:
          return Result.error(AssurancesError.NoReportPending);
        case AssurancesErrorCode.BAD_SIGNATURE:
          return Result.error(AssurancesError.InvalidSignature);
        case AssurancesErrorCode.NOT_SORTED_OR_UNIQUE_ASSURERS:
          return Result.error(AssurancesError.InvalidOrder);
        default:
          throw new Error(`Unhandled output error: ${out.err}`);
      }
    }

    throw new Error("Invalid output.");
  }
}

export class AssurancesTestTiny {
  static fromJson: FromJson<AssurancesTestTiny> = {
    input: inputFromJson(tinyChainSpec),
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export class AssurancesTestFull {
  static fromJson: FromJson<AssurancesTestFull> = {
    input: inputFromJson(fullChainSpec),
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export async function runAssurancesTestTiny(testContent: AssurancesTestTiny, path: string) {
  const preState = TestState.toAssurancesState(testContent.pre_state);
  const postState = TestState.toAssurancesState(testContent.post_state);
  const input = Input.toAssurancesInput(testContent.input, tinyChainSpec);

  const assurances = new Assurances(tinyChainSpec, preState);
  const res = await assurances.transition(input);

  const expectedResult = Output.toAssurancesTransitionResult(testContent.output);
  // validators are in incorrect order as well so it depends which error is checked first
  if (path.includes("assurances_with_bad_validator_index-1")) {
    if (!expectedResult.isError) {
      throw new Error(`Expected success in ${path}?`);
    }
    assert.strictEqual(expectedResult.error, AssurancesError.InvalidValidatorIndex);
    expectedResult.error = AssurancesError.InvalidOrder;
  }

  deepEqual(res, expectedResult, {
    context: "output",
    ignore: ["output.details"],
  });
  deepEqual(assurances.state, postState, { context: "state" });
}

export async function runAssurancesTestFull(testContent: AssurancesTestFull) {
  const preState = TestState.toAssurancesState(testContent.pre_state);
  const postState = TestState.toAssurancesState(testContent.post_state);
  const input = Input.toAssurancesInput(testContent.input, fullChainSpec);

  const assurances = new Assurances(fullChainSpec, preState);
  const res = await assurances.transition(input);

  deepEqual(assurances.state, postState, { context: "state" });
  deepEqual(res, Output.toAssurancesTransitionResult(testContent.output), {
    context: "output",
    ignore: ["output.details"],
  });
}

type DeepEqualOptions = {
  context?: string | string[];
  ignore?: string[];
  errorsCollector?: ErrorsCollector;
};

function deepEqual<T>(
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
  if (actual instanceof BytesBlob || expected instanceof BytesBlob) {
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

    const allKeys = getAllKeys<T>(actualKeys, expectedKeys);
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

function getAllKeys<T>(a: (keyof T)[], b: (keyof T)[]): (keyof T)[] {
  const all = a.concat(b);
  all.sort();
  // now dedupe
  return all.reduce(
    (acc, v) => {
      if (acc.length === 0) {
        return [v];
      }
      const last = acc[acc.length - 1];
      if (last !== v) {
        acc.push(v);
      }
      return acc;
    },
    [] as (keyof T)[],
  );
}

class ErrorsCollector {
  readonly errors: { context: string[]; e: unknown }[] = [];
  private nested = 0;

  enter() {
    this.nested += 1;
  }

  tryAndCatch(cb: () => void, context: string[]) {
    try {
      cb();
    } catch (e) {
      this.errors.push({ context, e });
    }
  }

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
      .map((e, idx) => `===== ${idx + 1}/${noOfErrors} =====\n ${e.stack}`)
      .join("\n");

    const e = new Error();
    e.stack = stack;
    throw e;
  }
}
