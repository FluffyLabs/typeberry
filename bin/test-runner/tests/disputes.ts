import assert from "node:assert";
import {
  type CodeHash,
  type CoreIndex,
  type Ed25519Key,
  type HeaderHash,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  type ValidatorData,
  type WorkReportHash,
  codec,
} from "@typeberry/block";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import type { WorkItemsCount } from "@typeberry/block/work-package";
import { SegmentRootLookupItem, type WorkPackageHash, WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { type Bytes, BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { Disputes } from "@typeberry/disputes";
import { AvailabilityAssignment, DisputesRecords, DisputesState } from "@typeberry/disputes";
import type { DisputesErrorCode } from "@typeberry/disputes/disputes-error-code";
import type { HASH_SIZE, OpaqueHash } from "@typeberry/hash";
import { type FromJson, json } from "@typeberry/json-parser";
import type { U16, U32 } from "@typeberry/numbers";
import type { TrieHash } from "@typeberry/trie";
import { fromJson as codecFromJson } from "./codec/common";
import { disputesExtrinsicFromJson } from "./codec/disputes-extrinsic";
import { fromJson } from "./safrole";

class TestPackageSpec {
  static fromJson: FromJson<TestPackageSpec> = {
    hash: codecFromJson.bytes32(),
    length: "number",
    erasure_root: codecFromJson.bytes32(),
    exports_root: codecFromJson.bytes32(),
    exports_count: "number",
  };

  static fromWorkPackageSpec(workPackageSpec: WorkPackageSpec) {
    const packageSpec = new TestPackageSpec();
    packageSpec.erasure_root = workPackageSpec.erasureRoot;
    packageSpec.exports_count = workPackageSpec.exportsCount;
    packageSpec.exports_root = workPackageSpec.exportsRoot;
    packageSpec.hash = workPackageSpec.hash;
    packageSpec.length = workPackageSpec.length;
    return packageSpec;
  }

  static toWorkPackageSpec(packageSpec: TestPackageSpec) {
    return new WorkPackageSpec(
      packageSpec.hash,
      packageSpec.length as U32,
      packageSpec.erasure_root,
      packageSpec.exports_root,
      packageSpec.exports_count as U16,
    );
  }

  hash!: WorkPackageHash;
  length!: number;
  erasure_root!: OpaqueHash;
  exports_root!: OpaqueHash;
  exports_count!: number;
}

class TestContext {
  static fromJson: FromJson<TestContext> = {
    anchor: codecFromJson.bytes32(),
    state_root: codecFromJson.bytes32(),
    beefy_root: codecFromJson.bytes32(),
    lookup_anchor: codecFromJson.bytes32(),
    lookup_anchor_slot: "number",
    prerequisites: json.array(codecFromJson.bytes32()),
  };

  static fromRefineContext(refineContext: RefineContext) {
    const context = new TestContext();
    context.anchor = refineContext.anchor;
    context.beefy_root = refineContext.beefyRoot;
    context.lookup_anchor = refineContext.lookupAnchor;
    context.lookup_anchor_slot = refineContext.lookupAnchorSlot;
    context.state_root = refineContext.stateRoot;
    context.prerequisites = refineContext.prerequisites;
    return context;
  }

  static toRefineContext(context: TestContext) {
    return new RefineContext(
      context.anchor as HeaderHash,
      context.state_root as TrieHash,
      context.beefy_root as BeefyHash,
      context.lookup_anchor as HeaderHash,
      context.lookup_anchor_slot as TimeSlot,
    );
  }
  anchor!: OpaqueHash;
  state_root!: OpaqueHash;
  beefy_root!: OpaqueHash;
  lookup_anchor!: OpaqueHash;
  lookup_anchor_slot!: number;
  prerequisites!: OpaqueHash[];
}

class TestResultDetail {
  static fromJson: FromJson<TestResultDetail> = {
    ok: json.fromString(BytesBlob.parseBlob),
  };

  static fromWorkExecResult(result: WorkExecResult) {
    const testResult = new TestResultDetail();
    testResult.ok = result.okBlob;
    return testResult;
  }

  static toWorkExecResult(testResultDetail: TestResultDetail) {
    return new WorkExecResult(WorkExecResultKind.ok, testResultDetail.ok);
  }
  ok!: BytesBlob | null;
}

class TestResult {
  static fromJson: FromJson<TestResult> = {
    service_id: "number",
    code_hash: codecFromJson.bytes32(),
    payload_hash: codecFromJson.bytes32(),
    gas: json.fromNumber((x) => BigInt(x)),
    result: TestResultDetail.fromJson,
  };

  static fromResults(results: FixedSizeArray<WorkResult, WorkItemsCount>) {
    return results.map((result) => {
      const testResult = new TestResult();
      testResult.code_hash = result.codeHash;
      testResult.gas = result.gas;
      testResult.payload_hash = result.payloadHash;
      testResult.result = TestResultDetail.fromWorkExecResult(result.result);
      testResult.service_id = result.serviceId;
      return testResult;
    });
  }

  static toResults(testResults: TestResult[]) {
    return testResults.map((testResult) => {
      return new WorkResult(
        testResult.service_id as ServiceId,
        testResult.code_hash as CodeHash,
        testResult.payload_hash,
        testResult.gas as ServiceGas,
        TestResultDetail.toWorkExecResult(testResult.result),
      );
    }) as FixedSizeArray<WorkResult, WorkItemsCount>;
  }

  service_id!: number;
  code_hash!: Bytes<HASH_SIZE>;
  payload_hash!: Bytes<HASH_SIZE>;
  gas!: bigint;
  result!: TestResultDetail;
}

class TestSegmentRootLookupItem {
  static fromJson: FromJson<TestSegmentRootLookupItem> = {
    work_package_hash: codecFromJson.bytes32(),
    segment_tree_root: codecFromJson.bytes32(),
  };

  work_package_hash!: WorkPackageHash;
  segment_tree_root!: OpaqueHash;

  static toSegmentRootLookupItem(testSegmentRootLookupItem: TestSegmentRootLookupItem) {
    return new SegmentRootLookupItem(
      testSegmentRootLookupItem.work_package_hash,
      testSegmentRootLookupItem.segment_tree_root,
    );
  }

  static fromSegmentRootLookupItem(segmentRootLookupItem: SegmentRootLookupItem) {
    const item = new TestSegmentRootLookupItem();
    item.segment_tree_root = segmentRootLookupItem.segmentTreeRoot;
    item.work_package_hash = segmentRootLookupItem.workPackageHash;
    return item;
  }
}

export class TestWorkReport {
  static fromJson: FromJson<TestWorkReport> = {
    package_spec: TestPackageSpec.fromJson,
    context: TestContext.fromJson,
    core_index: "number",
    authorizer_hash: codecFromJson.bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    segment_root_lookup: json.array(TestSegmentRootLookupItem.fromJson),
    results: json.array(TestResult.fromJson),
  };

  static fromWorkReport(workReport: WorkReport) {
    const testWorkReport = new TestWorkReport();
    testWorkReport.auth_output = workReport.authorizationOutput;
    testWorkReport.authorizer_hash = workReport.authorizerHash;
    testWorkReport.core_index = workReport.coreIndex;
    testWorkReport.context = TestContext.fromRefineContext(workReport.context);
    testWorkReport.package_spec = TestPackageSpec.fromWorkPackageSpec(workReport.workPackageSpec);
    testWorkReport.results = TestResult.fromResults(workReport.results);
    testWorkReport.segment_root_lookup = workReport.segmentRootLookup.map((item) =>
      TestSegmentRootLookupItem.fromSegmentRootLookupItem(item),
    );
    return testWorkReport;
  }

  static toWorkReport(testWorkReport: TestWorkReport) {
    return new WorkReport(
      TestPackageSpec.toWorkPackageSpec(testWorkReport.package_spec),
      TestContext.toRefineContext(testWorkReport.context),
      testWorkReport.core_index,
      testWorkReport.authorizer_hash,
      testWorkReport.auth_output,
      testWorkReport.segment_root_lookup.map((item) => TestSegmentRootLookupItem.toSegmentRootLookupItem(item)),
      TestResult.toResults(testWorkReport.results),
    );
  }

  package_spec!: TestPackageSpec;
  context!: TestContext;
  core_index!: CoreIndex;
  authorizer_hash!: OpaqueHash;
  auth_output!: BytesBlob;
  segment_root_lookup!: TestSegmentRootLookupItem[];
  results!: TestResult[];
}

class TestAvailabilityAssignment {
  static fromJson: FromJson<TestAvailabilityAssignment> = {
    report: TestWorkReport.fromJson,
    timeout: "number",
  };
  report!: TestWorkReport;
  timeout!: number;

  static fromAvailabilityAssignment(availabilityAssignments: (AvailabilityAssignment | null)[]) {
    return availabilityAssignments.map((availabilityAssignment) => {
      if (!availabilityAssignment) {
        return null;
      }

      const rho = new TestAvailabilityAssignment();
      rho.report = TestWorkReport.fromWorkReport(availabilityAssignment.workReport);
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
    good: json.array(codecFromJson.bytes32<WorkReportHash>()),
    bad: json.array(codecFromJson.bytes32<WorkReportHash>()),
    wonky: json.array(codecFromJson.bytes32<WorkReportHash>()),
    offenders: json.array(codecFromJson.bytes32<Ed25519Key>()),
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

  static fromDisputesRecords(disputesRecords: DisputesRecords) {
    const psi = new TestDisputesRecords();
    psi.good = disputesRecords.goodSet.slice();
    psi.bad = disputesRecords.badSet.slice();
    psi.wonky = disputesRecords.wonkySet.slice();
    psi.offenders = disputesRecords.punishSet.slice();
    return psi;
  }
}

class TestState {
  static fromJson: FromJson<TestState> = {
    psi: TestDisputesRecords.fromJson,
    rho: json.array(json.nullable(TestAvailabilityAssignment.fromJson)),
    tau: "number",
    kappa: json.array(fromJson.validatorData),
    lambda: json.array(fromJson.validatorData),
  };

  /** Disputes records. */
  psi!: TestDisputesRecords;
  /** Availability assignments. */
  rho!: Array<TestAvailabilityAssignment | null>;
  /** Time slot. */
  tau!: TimeSlot;
  /** Current validator set. */
  kappa!: ValidatorData[];
  /** Previous validator set. */
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
    const disputesRecords = DisputesRecords.fromSortedArrays(psi.good, psi.bad, psi.wonky, psi.offenders);
    const rho = testState.rho;
    const availabilityAssignment = rho.map((item) => {
      if (!item) {
        return null;
      }
      const workReport = TestWorkReport.toWorkReport(item.report);
      return new AvailabilityAssignment(
        workReport,
        item.timeout,
        codec.Encoder.encodeObject(WorkReport.Codec, workReport),
      );
    });

    return new DisputesState(disputesRecords, availabilityAssignment, testState.tau, testState.kappa, testState.lambda);
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

function getChainSpec(path: string) {
  if (path.includes("tiny")) {
    return tinyChainSpec;
  }

  return fullChainSpec;
}

export async function runDisputesTest(testContent: DisputesTest, path: string) {
  const chainSpec = getChainSpec(path);
  const preState = testContent.pre_state;

  const disputes = new Disputes(TestState.toDisputesState(preState), chainSpec);

  const result = await disputes.transition(testContent.input.disputes);
  const error = result.isError ? result.error : undefined;
  const ok = result.isOk ? result.ok : undefined;
  assert.deepEqual(error, testContent.output.err);
  assert.deepEqual(ok, testContent.output.ok?.offenders_mark);
  assert.deepEqual(TestState.fromDisputesState(disputes.state), testContent.post_state);
}
