import type { Ed25519Key, HeaderHash, ServiceId, TimeSlot, ValidatorData, WorkReportHash } from "@typeberry/block";
import type { GuaranteesExtrinsic } from "@typeberry/block/gaurantees";
import type { Bytes } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { fromJson as codecFromJson } from "./codec/common";
import { guaranteesExtrinsicFromJson } from "./codec/guarantees-extrinsic";
import { TestAvailabilityAssignment, TestSegmentRootLookupItem, commonFromJson } from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    guarantees: guaranteesExtrinsicFromJson,
    slot: "number",
  };

  guarantees!: GuaranteesExtrinsic;
  slot!: TimeSlot;
}

class ServiceInfo {
  static fromJson: FromJson<ServiceInfo> = {
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

class ServiceItem {
  static fromJson: FromJson<ServiceItem> = {
    id: "number",
    info: ServiceInfo.fromJson,
  };

  id!: ServiceId;
  info!: ServiceInfo;
}

class ReportedWorkPackage {
  static fromJson: FromJson<ReportedWorkPackage> = {
    hash: commonFromJson.bytes32(),
    exports_root: commonFromJson.bytes32(),
  };

  hash!: WorkReportHash;
  exports_root!: OpaqueHash;
}

class BlocksInfo {
  static fromJson: FromJson<BlocksInfo> = {
    header_hash: commonFromJson.bytes32(),
    mmr: {
      peaks: json.array(json.nullable(commonFromJson.bytes32())),
    },
    state_root: commonFromJson.bytes32(),
    reported: json.array(ReportedWorkPackage.fromJson),
  };

  header_hash!: HeaderHash;
  mmr!: {
    peaks: Array<OpaqueHash | null>;
  };
  state_root!: OpaqueHash;
  reported!: ReportedWorkPackage[];
}

class ReportsState {
  static fromJson: FromJson<ReportsState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(commonFromJson.validatorData),
    prev_validators: json.array(commonFromJson.validatorData),
    entropy: json.array(commonFromJson.bytes32()),
    offenders: json.array(codecFromJson.bytes32<Ed25519Key>()),
    auth_pools: ["array", json.array(codecFromJson.bytes32())],
    recent_blocks: json.array(BlocksInfo.fromJson),
    services: json.array(ServiceItem.fromJson),
  };
  avail_assignments!: Array<TestAvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
  prev_validators!: ValidatorData[];
  entropy!: Bytes<32>[];
  offenders!: Ed25519Key[];
  auth_pools!: OpaqueHash[][];
  recent_blocks!: BlocksInfo[];
  services!: ServiceItem[];
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
    pre_state: ReportsState.fromJson,
    output: Output.fromJson,
    post_state: ReportsState.fromJson,
  };
  input!: Input;
  pre_state!: ReportsState;
  output!: Output;
  post_state!: ReportsState;
}

export async function runReportsTest(_testContent: ReportsTest) {
  // TODO [MaSi] Implement
}
