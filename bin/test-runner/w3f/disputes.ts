import assert from "node:assert";
import { type TimeSlot, tryAsPerValidator } from "@typeberry/block";
import { disputesExtrinsicFromJson, fromJson } from "@typeberry/block-json";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import type { ChainSpec } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import { Disputes, type DisputesState } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code";
import { type FromJson, json } from "@typeberry/json-parser";
import { type AvailabilityAssignment, type DisputesRecords, type ValidatorData, tryAsPerCore } from "@typeberry/state";
import { availabilityAssignmentFromJson, disputesRecordsFromJson, validatorDataFromJson } from "@typeberry/state-json";
import { getChainSpec } from "./spec";

class DisputesOutputMarks {
  static fromJson: FromJson<DisputesOutputMarks> = {
    offenders_mark: json.array(fromJson.bytes32<Ed25519Key>()),
  };

  offenders_mark!: Ed25519Key[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    psi: disputesRecordsFromJson,
    rho: json.array(json.nullable(availabilityAssignmentFromJson)),
    tau: "number",
    kappa: json.array(validatorDataFromJson),
    lambda: json.array(validatorDataFromJson),
  };

  /** Disputes records. */
  psi!: DisputesRecords;
  /** Availability assignments. */
  rho!: Array<AvailabilityAssignment | null>;
  /** Time slot. */
  tau!: TimeSlot;
  /** Current validator set. */
  kappa!: ValidatorData[];
  /** Previous validator set. */
  lambda!: ValidatorData[];

  static toDisputesState(testState: TestState, spec: ChainSpec): DisputesState {
    const { rho, kappa, lambda } = testState;
    const availabilityAssignment = tryAsPerCore(rho, spec);
    const currentValidatorData = tryAsPerValidator(kappa, spec);
    const previousValidatorData = tryAsPerValidator(lambda, spec);

    return {
      disputesRecords: testState.psi,
      availabilityAssignment,
      timeslot: testState.tau,
      currentValidatorData,
      previousValidatorData,
    };
  }
}

class Input {
  static fromJson: FromJson<Input> = {
    disputes: disputesExtrinsicFromJson,
  };

  disputes!: DisputesExtrinsic;
}

export class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(DisputesOutputMarks.fromJson),
    err: json.optional("string"),
  };

  ok?: DisputesOutputMarks;
  err?: DisputesErrorCode;
}

export class DisputesTest {
  static fromJson: FromJson<DisputesTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export async function runDisputesTest(testContent: DisputesTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = testContent.pre_state;

  const disputes = new Disputes(chainSpec, TestState.toDisputesState(preState, chainSpec));

  const result = await disputes.transition(testContent.input.disputes);
  const error = result.isError ? result.error : undefined;
  const ok = result.isOk ? result.ok.slice() : undefined;

  assert.deepEqual(error, testContent.output.err);
  assert.deepEqual(ok, testContent.output.ok?.offenders_mark);
  assert.deepEqual(disputes.state, TestState.toDisputesState(testContent.post_state, chainSpec));
}
