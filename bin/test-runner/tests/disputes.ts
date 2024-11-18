import assert from "node:assert";
import type { Ed25519Key, TimeSlot, WorkReportHash } from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ChainSpec } from "@typeberry/config";
import { Disputes } from "@typeberry/disputes";
import { AvailabilityAssignment, DisputesRecords, DisputesState } from "@typeberry/disputes";
import { type FromJson, json } from "@typeberry/json-parser";
import type { ValidatorData } from "@typeberry/safrole";
import type { BlsKey } from "@typeberry/safrole/crypto";
import { fromJson as codecFromJson } from "./codec/common";
import { disputesExtrinsicFromJson } from "./codec/disputes-extrinsic";

namespace fromJson {
  export function bytes32() {
    return json.fromString((v) => Bytes.parseBytes(v, 32).asOpaque());
  }

  export const bytesBlob = json.fromString(BytesBlob.parseBlob);

  export const validatorData: FromJson<ValidatorData> = {
    ed25519: bytes32(),
    bandersnatch: bytes32(),
    bls: json.fromString((v) => Bytes.parseBytes(v, 144) as BlsKey),
    metadata: json.fromString((v) => Bytes.parseBytes(v, 128)),
  };
}

class TestAvailabilityAssignment {
  static fromJson: FromJson<TestAvailabilityAssignment> = {
    dummy_work_report: json.fromString((v) => Bytes.parseBytes(v, 354)),
    timeout: "number",
  };
  dummy_work_report!: Bytes<354>;
  timeout!: number;

  static fromAvailabilityAssignment(availabilityAssignments: (AvailabilityAssignment | undefined)[]) {
    return availabilityAssignments.map((availabilityAssignment) => {
      if (!availabilityAssignment) {
        return availabilityAssignment;
      }

      const rho = new TestAvailabilityAssignment();
      rho.dummy_work_report = availabilityAssignment.workReport;
      rho.timeout = availabilityAssignment.timeout;
      return rho;
    });
  }
}

class DisputesOutputMarks {
  static fromJson: FromJson<DisputesOutputMarks> = {
    offenders_mark: json.array(codecFromJson.bytes32<Ed25519Key>()),
  };

  offenders_mark!: Ed25519Key[];
}

class TestDisputesRecords {
  static fromJson: FromJson<TestDisputesRecords> = {
    psi_g: json.array(codecFromJson.bytes32<WorkReportHash>()),
    psi_b: json.array(codecFromJson.bytes32<WorkReportHash>()),
    psi_w: json.array(codecFromJson.bytes32<WorkReportHash>()),
    psi_o: json.array(codecFromJson.bytes32<Ed25519Key>()),
  };
  psi_g!: WorkReportHash[];
  psi_b!: WorkReportHash[];
  psi_w!: WorkReportHash[];
  psi_o!: Ed25519Key[];

  static fromDisputesRecords(disputesRecords: DisputesRecords) {
    const psi = new TestDisputesRecords();
    psi.psi_g = disputesRecords.goodSet.slice();
    psi.psi_b = disputesRecords.badSet.slice();
    psi.psi_w = disputesRecords.wonkySet.slice();
    psi.psi_o = disputesRecords.punishSet.slice();
    return psi;
  }
}

class TestState {
  static fromJson: FromJson<TestState> = {
    psi: TestDisputesRecords.fromJson,
    rho: json.array(json.optional(TestAvailabilityAssignment.fromJson)),
    tau: "number",
    kappa: json.array(fromJson.validatorData),
    lambda: json.array(fromJson.validatorData),
  };

  psi!: TestDisputesRecords;
  rho!: Array<TestAvailabilityAssignment | undefined>;
  tau!: TimeSlot;
  kappa!: ValidatorData[];
  lambda!: ValidatorData[];

  static fromDisputesState(disputesState: DisputesState) {
    const state = new TestState();

    state.psi = TestDisputesRecords.fromDisputesRecords(disputesState.disputesRecords);
    state.rho = TestAvailabilityAssignment.fromAvailabilityAssignment(disputesState.availabilityAssignment);
    state.tau = disputesState.timeslot;
    state.kappa = disputesState.currentValidatorData;
    state.lambda = disputesState.previousValidatorData;

    return state;
  }

  static toDisputesState(testState: TestState) {
    const psi = testState.psi;
    const disputesRecords = DisputesRecords.tryToCreateFromArrays(psi.psi_g, psi.psi_b, psi.psi_w, psi.psi_o);
    const rho = testState.rho;
    const availabilityAssignment = rho.map((item) =>
      !item ? item : new AvailabilityAssignment(item.dummy_work_report, item.timeout),
    );

    return new DisputesState(disputesRecords, availabilityAssignment, testState.tau, testState.kappa, testState.lambda);
  }
}

class Input {
  static fromJson: FromJson<Input> = {
    disputes: disputesExtrinsicFromJson,
  };

  disputes!: DisputesExtrinsic;
}

enum DisputesErrorCode {
  AlreadyJudged = "already_judged",
  BadVoteSplit = "bad_vote_split",
  VerdictsNotSortedUnique = "verdicts_not_sorted_unique",
  JudgementsNotSortedUnique = "judgements_not_sorted_unique",
  CulpritsNotSortedUnique = "culprits_not_sorted_unique",
  FaultsNotSortedUnique = "faults_not_sorted_unique",
  NotEnoughCulprits = "not_enough_culprits",
  NotEnoughFaults = "not_enough_faults",
  CulpritsVerdictNotBad = "culprits_verdict_not_bad",
  FaultVerdictWrong = "fault_verdict_wrong",
  OffenderAlreadyReported = "offender_already_reported",
  BadJudgementAge = "bad_judgement_age",
  BadValidatorIndex = "bad_validator_index",
  BadSignature = "bad_signature",
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

function getChainSpec(path: string) {
  if (path.includes("tiny")) {
    return new ChainSpec({
      validatorsCount: 6,
      epochLength: 12,
      coresCount: 1,
      contestLength: 1,
      slotDuration: 1,
      ticketsPerValidator: 1,
    });
  }

  return new ChainSpec({
    validatorsCount: 1023,
    epochLength: 600,
    coresCount: 1,
    contestLength: 1,
    slotDuration: 1,
    ticketsPerValidator: 1,
  });
}

export async function runDisputesTest(testContent: DisputesTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = testContent.pre_state;

  const disputes = new Disputes(TestState.toDisputesState(preState), chainSpec);

  const result = await disputes.transition(testContent.input.disputes);

  assert.deepEqual(result.err, testContent.output.err);
  assert.deepEqual(result.offendersMarks, testContent.output.ok?.offenders_mark);
  assert.deepEqual(TestState.fromDisputesState(disputes.state), testContent.post_state);
}
