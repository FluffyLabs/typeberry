import {
  type EntropyHash,
  type HeaderHash,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsPerValidator,
} from "@typeberry/block";
import { fromJson, guaranteesExtrinsicFromJson, segmentRootLookupItemFromJson } from "@typeberry/block-json";
import type { GuaranteesExtrinsic } from "@typeberry/block/guarantees.js";
import type { AuthorizerHash, WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { FixedSizeArray, HashDictionary, HashSet, asKnownSize } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import { type FromJson, json } from "@typeberry/json-parser";
import {
  type AvailabilityAssignment,
  type CoreStatistics,
  ENTROPY_ENTRIES,
  type InMemoryService,
  InMemoryState,
  type RecentBlocksHistory,
  type ValidatorData,
  tryAsPerCore,
} from "@typeberry/state";
import {
  JsonCoreStatistics,
  JsonService,
  type ServiceStatisticsEntry,
  availabilityAssignmentFromJson,
  recentBlocksHistoryFromJson,
  serviceStatisticsEntryFromJson,
  validatorDataFromJson,
} from "@typeberry/state-json";
import {
  Reports,
  ReportsError,
  type ReportsInput,
  type ReportsOutput,
  type ReportsState,
} from "@typeberry/transition/reports/index.js";
import { guaranteesAsView } from "@typeberry/transition/reports/test.utils.js";
import { copyAndUpdateState } from "@typeberry/transition/test.utils.js";
import { Result, deepEqual } from "@typeberry/utils";

type TestReportsOutput = Omit<ReportsOutput, "stateUpdate">;

class Input {
  static fromJson: FromJson<Input> = {
    guarantees: guaranteesExtrinsicFromJson,
    slot: "number",
    known_packages: json.array(fromJson.bytes32()),
  };

  guarantees!: GuaranteesExtrinsic;
  slot!: TimeSlot;
  known_packages!: WorkPackageHash[];

  static toReportsInput(
    input: Input,
    spec: ChainSpec,
    entropy: ReportsState["entropy"],
    recentBlocksPartialUpdate: ReportsState["recentBlocks"],
    assurancesAvailAssignment: ReportsState["availabilityAssignment"],
    offenders: HashSet<Ed25519Key>,
  ): ReportsInput {
    const view = guaranteesAsView(spec, input.guarantees, { disableCredentialsRangeCheck: true });

    return {
      guarantees: view,
      slot: input.slot,
      newEntropy: entropy,
      recentBlocksPartialUpdate,
      assurancesAvailAssignment,
      offenders,
    };
  }
}

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(availabilityAssignmentFromJson)),
    curr_validators: json.array(validatorDataFromJson),
    prev_validators: json.array(validatorDataFromJson),
    entropy: json.array(fromJson.bytes32()),
    offenders: json.array(fromJson.bytes32<Ed25519Key>()),
    recent_blocks: recentBlocksHistoryFromJson,
    auth_pools: ["array", json.array(fromJson.bytes32())],
    accounts: json.array(JsonService.fromJson),
    cores_statistics: json.array(JsonCoreStatistics.fromJson),
    services_statistics: json.array(serviceStatisticsEntryFromJson),
  };

  avail_assignments!: Array<AvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
  prev_validators!: ValidatorData[];
  entropy!: EntropyHash[];
  offenders!: Ed25519Key[];
  auth_pools!: AuthorizerHash[][];
  recent_blocks!: RecentBlocksHistory;
  accounts!: InMemoryService[];
  cores_statistics!: CoreStatistics[];
  services_statistics!: ServiceStatisticsEntry[];

  static toReportsState(
    pre: TestState,
    spec: ChainSpec,
  ): {
    state: ReportsState;
    offenders: HashSet<Ed25519Key>;
  } {
    return {
      state: InMemoryState.partial(spec, {
        accumulationQueue: tryAsPerEpochBlock(
          FixedSizeArray.fill(() => [], spec.epochLength),
          spec,
        ),
        recentlyAccumulated: tryAsPerEpochBlock(
          FixedSizeArray.fill(() => HashSet.new(), spec.epochLength),
          spec,
        ),
        availabilityAssignment: tryAsPerCore(pre.avail_assignments, spec),
        currentValidatorData: tryAsPerValidator(pre.curr_validators, spec),
        previousValidatorData: tryAsPerValidator(pre.prev_validators, spec),
        entropy: FixedSizeArray.new(pre.entropy, ENTROPY_ENTRIES),
        authPools: tryAsPerCore(
          pre.auth_pools.map((x) => asKnownSize(x)),
          spec,
        ),
        recentBlocks: pre.recent_blocks,
        services: new Map(pre.accounts.map((x) => [x.serviceId, x])),
      }),
      offenders: HashSet.from(pre.offenders),
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
  BannedValidator = "banned_validator",
}

class OutputData {
  static fromJson = json.object<OutputData, TestReportsOutput>(
    {
      reported: json.array(segmentRootLookupItemFromJson),
      reporters: json.array(fromJson.bytes32()),
    },
    ({ reported, reporters }) => ({
      stateUpdate: {},
      reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
      reporters,
    }),
  );

  reported!: WorkPackageInfo[];
  reporters!: ReportsOutput["reporters"];
}

type ReportsResult = Result<TestReportsOutput, ReportsError>;

class TestReportsResult {
  static fromJson: FromJson<TestReportsResult> = {
    ok: json.optional(OutputData.fromJson),
    err: json.optional("string"),
  };

  static toReportsResult(test: TestReportsResult): ReportsResult {
    if (test.ok !== undefined) {
      return Result.ok(test.ok);
    }

    if (test.err !== undefined) {
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
        [ReportsErrorCode.BannedValidator]: ReportsError.BannedValidator,
      };

      if (map[test.err] !== undefined) {
        return Result.error(map[test.err]);
      }
      throw new Error(`Unknown expected reports error code: "${test.err}"`);
    }

    throw new Error('Neither "ok" nor "err" is defined in output.');
  }

  ok?: TestReportsOutput;
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
  const postState = TestState.toReportsState(testContent.post_state, spec);
  const input = Input.toReportsInput(
    testContent.input,
    spec,
    preState.state.entropy,
    preState.state.recentBlocks, // note: for full fidelity this should be partially updated state, not prior state as it is now
    preState.state.availabilityAssignment,
    preState.offenders,
  );
  const expectedOutput = TestReportsResult.toReportsResult(testContent.output);

  // Seems like we don't have any additional source of information
  // for which lookup headers are in chain, so we just use the recent
  // blocks history.
  const headerChain = {
    isInChain(hash: HeaderHash) {
      return preState.state.recentBlocks.blocks.find((x) => x.headerHash.isEqualTo(hash)) !== undefined;
    },
  };

  const reports = new Reports(spec, preState.state, headerChain);

  const output = await reports.transition(input);
  let state = reports.state;
  if (output.isOk) {
    state = copyAndUpdateState(state, output.ok.stateUpdate);
  }

  deepEqual(output, expectedOutput, { context: "output", ignore: ["output.details", "output.ok.stateUpdate"] });
  deepEqual(state, postState.state, { context: "postState" });
}
