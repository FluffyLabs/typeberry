import { type Ed25519Key, type EntropyHash, type TimeSlot, tryAsPerValidator } from "@typeberry/block";
import { type GuaranteesExtrinsic, guaranteesExtrinsicCodec } from "@typeberry/block/guarantees";
import type { SegmentRootLookupItem } from "@typeberry/block/work-report";
import { Decoder, Encoder } from "@typeberry/codec";
import { FixedSizeArray } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import type { OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import {
  type AvailabilityAssignment,
  type BlockState,
  ENTROPY_ENTRIES,
  type Service,
  type ValidatorData,
  tryAsPerCore,
} from "@typeberry/state";
import {
  Reports,
  ReportsError,
  type ReportsInput,
  type ReportsOutput,
  type ReportsState,
} from "@typeberry/transition/reports";
import { Result, asOpaqueType } from "@typeberry/utils";
import { fromJson as codecFromJson } from "./codec/common";
import { guaranteesExtrinsicFromJson } from "./codec/guarantees-extrinsic";
import {
  TestAccountItem,
  TestAvailabilityAssignment,
  TestBlockState,
  TestSegmentRootLookupItem,
  commonFromJson,
} from "./common-types";

class Input {
  static fromJson: FromJson<Input> = {
    guarantees: guaranteesExtrinsicFromJson,
    slot: "number",
  };

  guarantees!: GuaranteesExtrinsic;
  slot!: TimeSlot;

  static toReportsInput(input: Input, spec: ChainSpec): ReportsInput {
    const encoded = Encoder.encodeObject(guaranteesExtrinsicCodec, input.guarantees, spec);
    const view = Decoder.decodeObject(guaranteesExtrinsicCodec.View, encoded, spec);

    return {
      guarantees: view,
      slot: input.slot,
    };
  }
}

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(commonFromJson.validatorData),
    prev_validators: json.array(commonFromJson.validatorData),
    entropy: json.array(commonFromJson.bytes32()),
    offenders: json.array(codecFromJson.bytes32<Ed25519Key>()),
    auth_pools: ["array", json.array(codecFromJson.bytes32())],
    recent_blocks: json.array(TestBlockState.fromJson),
    accounts: json.array(TestAccountItem.fromJson),
  };

  avail_assignments!: Array<AvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
  prev_validators!: ValidatorData[];
  entropy!: EntropyHash[];
  offenders!: Ed25519Key[];
  auth_pools!: OpaqueHash[][];
  recent_blocks!: BlockState[];
  accounts!: Service[];

  static toReportsState(pre: TestState, spec: ChainSpec): ReportsState {
    return {
      availabilityAssignment: tryAsPerCore(pre.avail_assignments, spec),
      currentValidatorData: tryAsPerValidator(pre.curr_validators, spec),
      previousValidatorData: tryAsPerValidator(pre.prev_validators, spec),
      entropy: FixedSizeArray.new(pre.entropy, ENTROPY_ENTRIES),
      offenders: asOpaqueType(pre.offenders),
      authPools: tryAsPerCore(pre.auth_pools.map(asOpaqueType), spec),
      recentBlocks: asOpaqueType(pre.recent_blocks),
      accounts: pre.accounts,
    };
  }
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
  static fromJson = json.object<OutputData, ReportsOutput>(
    {
      reported: json.array(TestSegmentRootLookupItem.fromJson),
      reporters: json.array(codecFromJson.bytes32()),
    },
    ({ reported, reporters }) => ({
      reported,
      reporters,
    }),
  );

  reported!: SegmentRootLookupItem[];
  reporters!: Ed25519Key[];
}

type ReportsResult = Result<ReportsOutput, ReportsError>;

class TestReportsResult {
  static fromJson: FromJson<TestReportsResult> = {
    ok: json.optional(OutputData.fromJson),
    err: json.optional("string"),
  };

  static toReportsResult(test: TestReportsResult): ReportsResult {
    if (test.ok) {
      return Result.ok(test.ok);
    }

    if (test.err) {
      const map = {
        [ReportsErrorCode.BadCoreIndex]: ReportsError.BadCoreIndex,
        [ReportsErrorCode.FutureReportSlot]: ReportsError.FutureReportSlot,
        [ReportsErrorCode.ReportEpochBeforeLast]: ReportsError.ReportEpochBeforeLast,
        [ReportsErrorCode.InsufficientGuarantees]: ReportsError.InsufficientGuarantees,
        [ReportsErrorCode.OutOfOrderGuarantee]: ReportsError.OutOfOrderGuarantee,
        [ReportsErrorCode.NotSortedOrUniqueGuarantors]: ReportsError.NotSortedOrUniqueGuarantors,
        [ReportsErrorCode.WrongAssignment]: ReportsError.WrongAssignment,
        [ReportsErrorCode.CoreEngaged]: ReportsError.CoreEngaged,
        [ReportsErrorCode.AnchorNotRecent]: ReportsError.AnchorNotRecent,
        [ReportsErrorCode.BadServiceId]: ReportsError.BadServiceId,
        [ReportsErrorCode.BadCodeHash]: ReportsError.BadCodeHash,
        [ReportsErrorCode.DependencyMissing]: ReportsError.DependencyMissing,
        [ReportsErrorCode.DuplicatePackage]: ReportsError.DuplicatePackage,
        [ReportsErrorCode.BadStateRoot]: ReportsError.BadStateRoot,
        [ReportsErrorCode.BadBeefyMmrRoot]: ReportsError.BadBeefyMmrRoot,
        [ReportsErrorCode.CoreUnauthorized]: ReportsError.CoreUnauthorized,
        [ReportsErrorCode.BadValidatorIndex]: ReportsError.BadValidatorIndex,
        [ReportsErrorCode.WorkReportGasTooHigh]: ReportsError.WorkReportGasTooHigh,
        [ReportsErrorCode.ServiceItemGasTooLow]: ReportsError.ServiceItemGasTooLow,
        [ReportsErrorCode.TooManyDependencies]: ReportsError.TooManyDependencies,
        [ReportsErrorCode.SegmentRootLookupInvalid]: ReportsError.SegmentRootLookupInvalid,
        [ReportsErrorCode.BadSignature]: ReportsError.BadSignature,
        [ReportsErrorCode.WorkReportTooBig]: ReportsError.WorkReportTooBig,
      };

      if (map[test.err] !== undefined) {
        return Result.error(map[test.err]);
      }
      throw new Error(`Unknown expected reports error code: "${test.err}"`);
    }

    throw new Error('Neither "ok" nor "err" is defined in output.');
  }

  ok?: ReportsOutput;
  err?: ReportsErrorCode;
}

export class ReportsTest {
  static fromJson: FromJson<ReportsTest> = {
    input: Input.fromJson,
    pre_state: TestState.fromJson,
    output: TestReportsResult.fromJson,
    post_state: TestState.fromJson,
  };
  input!: Input;
  pre_state!: TestState;
  output!: TestReportsResult;
  post_state!: TestState;
}

export async function runReportsTestTiny(testContent: ReportsTest) {
  await runReportsTest(testContent, tinyChainSpec);
}

export async function runReportsTestFull(testContent: ReportsTest) {
  await runReportsTest(testContent, fullChainSpec);
}

async function runReportsTest(testContent: ReportsTest, spec: ChainSpec) {
  const preState = TestState.toReportsState(testContent.pre_state, spec);
  const _postState = TestState.toReportsState(testContent.post_state, spec);
  const input = Input.toReportsInput(testContent.input, spec);
  const _expectedOutput = TestReportsResult.toReportsResult(testContent.output);

  const reports = new Reports(spec, preState);

  const _output = reports.transition(input);

  // TODO [ToDr] Implement reports transition.

  // deepEqual(output, expectedOutput, { context: "output" });
  // deepEqual(reports.state, postState, { context: "postState" });
}
