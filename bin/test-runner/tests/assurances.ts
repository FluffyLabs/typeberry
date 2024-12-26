import type { HeaderHash, TimeSlot, ValidatorData } from "@typeberry/block";
import type { AssurancesExtrinsic } from "@typeberry/block/assurances";
import type { WorkReport } from "@typeberry/block/work-report";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type FromJson, json } from "@typeberry/json-parser";
import { getAssurancesExtrinsicFromJson } from "./codec/assurances-extrinsic";
import { workReportFromJson } from "./codec/work-report";
import { TestAvailabilityAssignment, commonFromJson } from "./common-types";

/*
State ::= SEQUENCE {
    -- [κ'] Posterior active validators.
    curr-validators ValidatorsData
}


*/

class InputTiny {
  static fromJson: FromJson<InputTiny> = {
    assurances: getAssurancesExtrinsicFromJson(tinyChainSpec),
    slot: "number",
    parent: commonFromJson.bytes32(),
  };

  assurances!: AssurancesExtrinsic;
  slot!: TimeSlot;
  parent!: HeaderHash;
}

class InputFull {
  static fromJson: FromJson<InputFull> = {
    assurances: getAssurancesExtrinsicFromJson(fullChainSpec),
    slot: "number",
    parent: commonFromJson.bytes32(),
  };

  assurances!: AssurancesExtrinsic;
  slot!: TimeSlot;
  parent!: HeaderHash;
}

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(commonFromJson.validatorData),
  };

  avail_assignments!: Array<TestAvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
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
}

export class AssurancesTestTiny {
  static fromJson: FromJson<AssurancesTestTiny> = {
    input: InputTiny.fromJson,
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: InputTiny;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export class AssurancesTestFull {
  static fromJson: FromJson<AssurancesTestFull> = {
    input: InputFull.fromJson,
    pre_state: TestState.fromJson,
    output: Output.fromJson,
    post_state: TestState.fromJson,
  };
  input!: InputFull;
  pre_state!: TestState;
  output!: Output;
  post_state!: TestState;
}

export async function runAssurancesTestTiny(_testContent: AssurancesTestTiny) {
  // TODO [MaSi] Implement
}

export async function runAssurancesTestFull(_testContent: AssurancesTestFull) {
  // TODO [MaSi] Implement
}
