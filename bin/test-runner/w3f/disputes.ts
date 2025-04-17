import assert from "node:assert";
import { type Ed25519Key, type TimeSlot, type WorkReportHash, tryAsPerValidator } from "@typeberry/block";
import { disputesExtrinsicFromJson, fromJson } from "@typeberry/block-json";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import type { ChainSpec } from "@typeberry/config";
import { Disputes, type DisputesState } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code";
import { type FromJson, json } from "@typeberry/json-parser";
import { type AvailabilityAssignment, DisputesRecords, type ValidatorData, tryAsPerCore } from "@typeberry/state";
import { TestAvailabilityAssignment, commonFromJson, getChainSpec } from "./common-types";

class DisputesOutputMarks {
  static fromJson: FromJson<DisputesOutputMarks> = {
    offenders_mark: json.array(fromJson.bytes32<Ed25519Key>()),
  };

  offenders_mark!: Ed25519Key[];
}

class TestDisputesRecords {
  static fromJson: FromJson<TestDisputesRecords> = {
    good: json.array(fromJson.bytes32<WorkReportHash>()),
    bad: json.array(fromJson.bytes32<WorkReportHash>()),
    wonky: json.array(fromJson.bytes32<WorkReportHash>()),
    offenders: json.array(fromJson.bytes32<Ed25519Key>()),
  };

  /**
   * psi = {psi_g, psi_b, psi_w, psi_o}
   * GP: https://graypaper.fluffylabs.dev/#/364735a/121400123100
   */
  /** "Good" set */
  good!: WorkReportHash[];
  /** "Bad" set */
  bad!: WorkReportHash[];
  /** "Wonky" set */
  wonky!: WorkReportHash[];
  /** "Punish" set */
  offenders!: Ed25519Key[];
}

class TestState {
  static fromJson: FromJson<TestState> = {
    psi: TestDisputesRecords.fromJson,
    rho: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    tau: "number",
    kappa: json.array(commonFromJson.validatorData),
    lambda: json.array(commonFromJson.validatorData),
  };

  /** Disputes records. */
  psi!: TestDisputesRecords;
  /** Availability assignments. */
  rho!: Array<AvailabilityAssignment | null>;
  /** Time slot. */
  tau!: TimeSlot;
  /** Current validator set. */
  kappa!: ValidatorData[];
  /** Previous validator set. */
  lambda!: ValidatorData[];

  static toDisputesState(testState: TestState, spec: ChainSpec): DisputesState {
    const psi = testState.psi;
    const disputesRecords = DisputesRecords.fromSortedArrays(psi.good, psi.bad, psi.wonky, psi.offenders);
    const { rho, kappa, lambda } = testState;
    const availabilityAssignment = tryAsPerCore(rho, spec);
    const currentValidatorData = tryAsPerValidator(kappa, spec);
    const previousValidatorData = tryAsPerValidator(lambda, spec);

    return {
      disputesRecords,
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
  /**
   * bad_signatures-2 has more than one problem and the result depends on order of checks.
   *
   * https://github.com/w3f/jamtestvectors/pull/9#issuecomment-2509867864
   */
  if (!path.includes("bad_signatures-2")) {
    assert.deepEqual(error, testContent.output.err);
  }
  assert.deepEqual(ok, testContent.output.ok?.offenders_mark);
  assert.deepEqual(disputes.state, TestState.toDisputesState(testContent.post_state, chainSpec));
}
