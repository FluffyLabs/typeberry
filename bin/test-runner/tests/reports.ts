import type { Ed25519Key, ServiceId, TimeSlot, ValidatorData } from "@typeberry/block";
import type { GuaranteesExtrinsic } from "@typeberry/block/gaurantees";
import type { Bytes } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { fromJson as codecFromJson } from "./codec/common";
import { guaranteesExtrinsicFromJson } from "./codec/guarantees-extrinsic";
import { TestAvailabilityAssignment, TestBlocksInfo, TestSegmentRootLookupItem, commonFromJson } from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    guarantees: guaranteesExtrinsicFromJson,
    slot: "number",
  };

  guarantees!: GuaranteesExtrinsic;
  slot!: TimeSlot;
}

class TestServiceInfo {
  static fromJson: FromJson<TestServiceInfo> = {
    code_hash: commonFromJson.bytes32(),
    balance: "number",
    min_item_gas: "number",
    min_memo_gas: "number",
    bytes: "number",
    items: "number",
  };

  code_hash!: OpaqueHash;
  balance!: U32; // it should be U64
  min_item_gas!: U32;
  min_memo_gas!: U32;
  bytes!: U32;
  items!: U32;
}

class TestServiceItem {
  static fromJson: FromJson<TestServiceItem> = {
    id: "number",
    info: TestServiceInfo.fromJson,
  };

  id!: ServiceId;
  info!: TestServiceInfo;
}

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(commonFromJson.validatorData),
    prev_validators: json.array(commonFromJson.validatorData),
    entropy: json.array(commonFromJson.bytes32()),
    offenders: json.array(codecFromJson.bytes32<Ed25519Key>()),
    auth_pools: ["array", json.array(codecFromJson.bytes32())],
    recent_blocks: json.array(TestBlocksInfo.fromJson),
    services: json.array(TestServiceItem.fromJson),
  };
  avail_assignments!: Array<TestAvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
  prev_validators!: ValidatorData[];
  entropy!: Bytes<32>[];
  offenders!: Ed25519Key[];
  auth_pools!: OpaqueHash[][];
  recent_blocks!: TestBlocksInfo[];
  services!: TestServiceItem[];
}

enum ReportsErrorCode {
  BadCoreIndex = "bad_core_index",
  FutureReportSlot = "future_report_slot",
  ReportEpochBeforeLast = "report_epoch_before_last",
  InsufficientGuarantees = "insufficient_guarantees",
  OutOfOrderGuarantee = "out_of_order_guarantee",
  NotSortedOrUniqueGuarantors = "not_sorted_or_unique_guarantors",
  WrongAssignment = "wrong_assignment",
  CoreEngaged = "core_engaged",
  AnchorNotRecent = "anchor_not_recent",
  BadServiceId = "bad_service_id",
  BadCodeHash = "bad_code_hash",
  DependencyMissing = "dependency_missing",
  DuplicatePackage = "duplicate_package",
  BadStateRoot = "bad_state_root",
  BadBeefyMmrRoot = "bad_beefy_mmr_root",
  CoreUnauthorized = "core_unauthorized",
  BadValidatorIndex = "bad_validator_index",
  WorkReportGasTooHigh = "work_report_gas_too_high",
  ServiceItemGasTooLow = "service_item_gas_too_low",
  TooManyDependencies = "too_many_dependencies",
  SegmentRootLookupInvalid = "segment_root_lookup_invalid",
  BadSignature = "bad_signature",
  WorkReportTooBig = "work_report_too_big",
}

class OutputData {
  static fromJson: FromJson<OutputData> = {
    reported: json.array(TestSegmentRootLookupItem.fromJson),
    reporters: json.array(codecFromJson.bytes32()),
  };

  reported!: TestSegmentRootLookupItem[];
  reporters!: Ed25519Key[];
}

class Output {
  static fromJson: FromJson<Output> = {
    ok: json.optional(OutputData.fromJson),
    err: json.optional("string"),
  };

  ok?: OutputData;
  err?: ReportsErrorCode;
}

export class ReportsTest {
  static fromJson: FromJson<ReportsTest> = {
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

export async function runReportsTest(_testContent: ReportsTest) {
  // TODO [MaSi] Implement
}
