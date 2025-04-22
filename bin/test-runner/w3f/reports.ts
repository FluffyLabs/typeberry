import {
  type Ed25519Key,
  type EntropyHash,
  type HeaderHash,
  type TimeSlot,
  tryAsPerEpochBlock,
  tryAsPerValidator,
} from "@typeberry/block";
import { fromJson, guaranteesExtrinsicFromJson } from "@typeberry/block-json";
import type { GuaranteesExtrinsic } from "@typeberry/block/guarantees";
import {
  type AuthorizerHash,
  type ExportsRootHash,
  type WorkPackageHash,
  WorkPackageInfo,
} from "@typeberry/block/work-report";
import { FixedSizeArray, HashDictionary, HashSet, asKnownSize } from "@typeberry/collections";
import { type ChainSpec, fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type KeccakHash, keccak } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { MmrHasher } from "@typeberry/mmr";
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
import { guaranteesAsView } from "@typeberry/transition/reports/test.utils";
import { Result, asOpaqueType, deepEqual, resultToString } from "@typeberry/utils";
import { logger } from "../common";
import { TestAccountItem, TestAvailabilityAssignment, TestBlockState, validatorDataFromJson } from "./common-types";

class TestSegmentRootLookupItem {
  static fromJson = json.object<TestSegmentRootLookupItem, WorkPackageInfo>(
    {
      work_package_hash: fromJson.bytes32(),
      segment_tree_root: fromJson.bytes32(),
    },
    ({ work_package_hash, segment_tree_root }) => new WorkPackageInfo(work_package_hash, segment_tree_root),
  );

  work_package_hash!: WorkPackageHash;
  segment_tree_root!: ExportsRootHash;
}

class Input {
  static fromJson: FromJson<Input> = {
    guarantees: guaranteesExtrinsicFromJson,
    slot: "number",
    known_packages: json.array(fromJson.bytes32()),
  };

  guarantees!: GuaranteesExtrinsic;
  slot!: TimeSlot;
  known_packages!: WorkPackageHash[];

  static toReportsInput(input: Input, spec: ChainSpec): ReportsInput {
    const view = guaranteesAsView(spec, input.guarantees, { disableCredentialsRangeCheck: true });

    return {
      guarantees: view,
      slot: input.slot,
      knownPackages: input.known_packages,
    };
  }
}

class TestCoreStatistics {
  static fromJson: FromJson<TestCoreStatistics> = {
    da_load: "number",
    popularity: "number",
    imports: "number",
    exports: "number",
    extrinsic_size: "number",
    extrinsic_count: "number",
    bundle_size: "number",
    gas_used: "number",
  };

  da_load!: number;
  popularity!: number;
  imports!: number;
  exports!: number;
  extrinsic_size!: number;
  extrinsic_count!: number;
  bundle_size!: number;
  gas_used!: number;
}

class TestServiceRecord {
  static fromJson: FromJson<TestServiceRecord> = {
    provided_count: "number",
    provided_size: "number",
    refinement_count: "number",
    refinement_gas_used: "number",
    imports: "number",
    exports: "number",
    extrinsic_size: "number",
    extrinsic_count: "number",
    accumulate_count: "number",
    accumulate_gas_used: "number",
    on_transfers_count: "number",
    on_transfers_gas_used: "number",
  };
  provided_count!: number;
  provided_size!: number;
  refinement_count!: number;
  refinement_gas_used!: number;
  imports!: number;
  exports!: number;
  extrinsic_size!: number;
  extrinsic_count!: number;
  accumulate_count!: number;
  accumulate_gas_used!: number;
  on_transfers_count!: number;
  on_transfers_gas_used!: number;
}

class TestServiceStatistics {
  static fromJson: FromJson<TestServiceStatistics> = {
    id: "number",
    record: TestServiceRecord.fromJson,
  };

  id!: number;
  record!: TestServiceRecord;
}

class TestState {
  static fromJson: FromJson<TestState> = {
    avail_assignments: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    curr_validators: json.array(validatorDataFromJson),
    prev_validators: json.array(validatorDataFromJson),
    entropy: json.array(fromJson.bytes32()),
    offenders: json.array(fromJson.bytes32<Ed25519Key>()),
    recent_blocks: json.array(TestBlockState.fromJson),
    auth_pools: ["array", json.array(fromJson.bytes32())],
    accounts: json.array(TestAccountItem.fromJson),
    cores_statistics: json.array(TestCoreStatistics.fromJson),
    services_statistics: json.array(TestServiceStatistics.fromJson),
  };

  avail_assignments!: Array<AvailabilityAssignment | null>;
  curr_validators!: ValidatorData[];
  prev_validators!: ValidatorData[];
  entropy!: EntropyHash[];
  offenders!: Ed25519Key[];
  auth_pools!: AuthorizerHash[][];
  recent_blocks!: BlockState[];
  accounts!: Service[];
  cores_statistics!: TestCoreStatistics[];
  services_statistics!: TestServiceStatistics[];

  static toReportsState(pre: TestState, spec: ChainSpec): ReportsState {
    if (pre.offenders.length > 0) {
      // TODO [ToDr] offenders are not used in `Reports` STF, so there is
      // probably something wrong there.
      throw new Error("Ignoring non-empty offenders!");
    }

    return {
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
      recentBlocks: asOpaqueType(pre.recent_blocks),
      services: new Map(pre.accounts.map((x) => [x.id, x])),
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
      reporters: json.array(fromJson.bytes32()),
    },
    ({ reported, reporters }) => ({
      reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
      reporters,
    }),
  );

  reported!: WorkPackageInfo[];
  reporters!: ReportsOutput["reporters"];
}

type ReportsResult = Result<ReportsOutput, ReportsError>;

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
  const postState = TestState.toReportsState(testContent.post_state, spec);
  const input = Input.toReportsInput(testContent.input, spec);
  const expectedOutput = TestReportsResult.toReportsResult(testContent.output);

  const keccakHasher = await keccak.KeccakHasher.create();
  const hasher: MmrHasher<KeccakHash> = {
    hashConcat: (a, b) => keccak.hashBlobs(keccakHasher, [a, b]),
    hashConcatPrepend: (id, a, b) => keccak.hashBlobs(keccakHasher, [id, a, b]),
  };
  // Seems like we don't have any additional source of information
  // for which lookup headers are in chain, so we just use the recent
  // blocks history.
  const headerChain = {
    isInChain(hash: HeaderHash) {
      return preState.recentBlocks.find((x) => x.headerHash.isEqualTo(hash)) !== undefined;
    },
  };

  const reports = new Reports(spec, preState, hasher, headerChain);

  const output = await reports.transition(input);
  logger.log(`ReportsTest { ${resultToString(output)} }`);

  deepEqual(output, expectedOutput, { context: "output", ignore: ["output.details"] });
  deepEqual(reports.state, postState, { context: "postState" });
}
