import assert from "node:assert";
import { type HeaderHash, type TimeSlot, tryAsPerValidator } from "@typeberry/block";
import { type AssurancesExtrinsic, assurancesExtrinsicCodec } from "@typeberry/block/assurances.js";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { fromJson, getAssurancesExtrinsicFromJson, workReportFromJson } from "@typeberry/block-json";
import { Decoder, Encoder } from "@typeberry/codec";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { Blake2b } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import { type AvailabilityAssignment, type State, tryAsPerCore, type ValidatorData } from "@typeberry/state";
import { availabilityAssignmentFromJson, validatorDataFromJson } from "@typeberry/state-json";
import {
  Assurances,
  AssurancesError,
  type AssurancesInput,
  type AssurancesState,
} from "@typeberry/transition/assurances.js";
import { copyAndUpdateState } from "@typeberry/transition/test.utils.js";
import { deepEqual, Result } from "@typeberry/utils";

const blake2b = Blake2b.createHasher();

class Input {
  assurances!: AssurancesExtrinsic;
  slot!: TimeSlot;
  parent!: HeaderHash;

  static toAssurancesInput(
    input: Input,
    chainSpec: ChainSpec,
    disputesAvailAssignment: State["availabilityAssignment"],
  ): AssurancesInput {
    const encoded = Encoder.encodeObject(assurancesExtrinsicCodec, input.assurances, chainSpec);
    const assurances = Decoder.decodeObject(assurancesExtrinsicCodec.View, encoded, chainSpec);

    return {
      assurances,
      slot: input.slot,
      parentHash: input.parent,
      disputesAvailAssignment,
    };
  }
}

const inputFromJson = (spec: ChainSpec): FromJson<Input> => ({
  assurances: getAssurancesExtrinsicFromJson(spec),
  slot: "number",
  parent: fromJson.bytes32(),
});

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(availabilityAssignmentFromJson)),
    curr_validators: json.array(validatorDataFromJson),
  };

  avail_assignments!: Array<AvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];

  static toAssurancesState(test: TestState, spec: ChainSpec): AssurancesState {
    const { avail_assignments, curr_validators } = test;

    return {
      availabilityAssignment: tryAsPerCore(avail_assignments, spec),
      currentValidatorData: tryAsPerValidator(curr_validators, spec),
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
    if (out.ok !== undefined) {
      return Result.ok(out.ok.reported);
    }

    if (out.err !== undefined) {
      switch (out.err) {
        case AssurancesErrorCode.BAD_ATTESTATION_PARENT:
          return Result.error(AssurancesError.InvalidAnchor, () => "Invalid anchor: bad attestation parent");
        case AssurancesErrorCode.BAD_VALIDATOR_INDEX:
          return Result.error(AssurancesError.InvalidValidatorIndex, () => "Invalid validator index");
        case AssurancesErrorCode.CORE_NOT_ENGAGED:
          return Result.error(AssurancesError.NoReportPending, () => "No report pending: core not engaged");
        case AssurancesErrorCode.BAD_SIGNATURE:
          return Result.error(AssurancesError.InvalidSignature, () => "Invalid signature");
        case AssurancesErrorCode.NOT_SORTED_OR_UNIQUE_ASSURERS:
          return Result.error(AssurancesError.InvalidOrder, () => "Invalid order: assurers not sorted or unique");
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
  const spec = tinyChainSpec;
  const preState = TestState.toAssurancesState(testContent.pre_state, spec);
  const postState = TestState.toAssurancesState(testContent.post_state, spec);
  const input = Input.toAssurancesInput(testContent.input, spec, preState.availabilityAssignment);
  const expectedResult = Output.toAssurancesTransitionResult(testContent.output);

  await runAssurancesTest(path, spec, preState, postState, input, expectedResult);
}

export async function runAssurancesTestFull(testContent: AssurancesTestFull, path: string) {
  const spec = fullChainSpec;
  const preState = TestState.toAssurancesState(testContent.pre_state, spec);
  const postState = TestState.toAssurancesState(testContent.post_state, spec);
  const input = Input.toAssurancesInput(testContent.input, spec, preState.availabilityAssignment);
  const expectedResult = Output.toAssurancesTransitionResult(testContent.output);

  await runAssurancesTest(path, spec, preState, postState, input, expectedResult);
}

async function runAssurancesTest(
  path: string,
  spec: ChainSpec,
  preState: AssurancesState,
  postState: AssurancesState,
  input: AssurancesInput,
  expectedResult: Result<WorkReport[], AssurancesError>,
) {
  const assurances = new Assurances(spec, preState, await blake2b);
  const res = await assurances.transition(input);

  // validators are in incorrect order as well so it depends which error is checked first
  if (path.includes("assurances_with_bad_validator_index-1")) {
    if (!expectedResult.isError) {
      throw new Error(`Expected success in ${path}?`);
    }
    assert.strictEqual(expectedResult.error, AssurancesError.InvalidValidatorIndex);
    expectedResult.error = AssurancesError.InvalidOrder;
  }

  if (res.isError) {
    deepEqual(res, expectedResult, {
      context: "output",
      ignore: ["output.details"],
    });
    deepEqual(assurances.state, postState, { context: "state" });
  } else {
    const { availableReports, stateUpdate } = res.ok;
    const result = copyAndUpdateState(preState, stateUpdate);
    deepEqual(Result.ok(availableReports), expectedResult);
    deepEqual(result, postState, { context: "state" });
  }
}
