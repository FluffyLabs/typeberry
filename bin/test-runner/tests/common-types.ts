import { type FromJson, json } from "@typeberry/json-parser";

import {
  BLS_KEY_BYTES,
  type BlsKey,
  type CodeHash,
  type CoreIndex,
  type HeaderHash,
  type ServiceGas,
  type ServiceId,
  type StateRootHash,
  type TimeSlot,
  VALIDATOR_META_BYTES,
  type ValidatorData,
} from "@typeberry/block";
import { RefineContext } from "@typeberry/block/refine-context";
import type { WorkItemsCount } from "@typeberry/block/work-package";
import {
  type ExportsRootHash,
  SegmentRootLookupItem,
  type WorkPackageHash,
  WorkPackageSpec,
  WorkReport,
} from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import type { FixedSizeArray } from "@typeberry/collections";
import type { AvailabilityAssignment } from "@typeberry/disputes";
import type { HASH_SIZE, OpaqueHash } from "@typeberry/hash";
import type { U16, U32 } from "@typeberry/numbers";
import { Bytes, BytesBlob } from "@typeberry/trie";
import { fromJson as codecFromJson } from "./codec/common";

export namespace commonFromJson {
  export function bytes32<TInto extends Bytes<32>>() {
    return json.fromString((v) => Bytes.parseBytes(v, 32) as TInto);
  }

  export const validatorData: FromJson<ValidatorData> = {
    ed25519: bytes32(),
    bandersnatch: bytes32(),
    bls: json.fromString((v) => Bytes.parseBytes(v, BLS_KEY_BYTES) as BlsKey),
    metadata: json.fromString((v) => Bytes.parseBytes(v, VALIDATOR_META_BYTES)),
  };
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
    accumulate_gas: json.fromNumber((x) => BigInt(x)),
    result: TestResultDetail.fromJson,
  };

  static fromResults(results: FixedSizeArray<WorkResult, WorkItemsCount>) {
    return results.map((result) => {
      const testResult = new TestResult();
      testResult.code_hash = result.codeHash;
      testResult.accumulate_gas = result.gas;
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
        testResult.accumulate_gas as ServiceGas,
        TestResultDetail.toWorkExecResult(testResult.result),
      );
    }) as FixedSizeArray<WorkResult, WorkItemsCount>;
  }

  service_id!: number;
  code_hash!: Bytes<HASH_SIZE>;
  payload_hash!: Bytes<HASH_SIZE>;
  accumulate_gas!: bigint;
  result!: TestResultDetail;
}

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
  exports_root!: ExportsRootHash;
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
      context.anchor.asOpaque(),
      context.state_root.asOpaque(),
      context.beefy_root.asOpaque(),
      context.lookup_anchor.asOpaque(),
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

export class TestSegmentRootLookupItem {
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

export class TestAvailabilityAssignment {
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

export class TestReportedWorkPackage {
  static fromJson: FromJson<TestReportedWorkPackage> = {
    hash: commonFromJson.bytes32(),
    exports_root: commonFromJson.bytes32(),
  };

  hash!: WorkPackageHash;
  exports_root!: ExportsRootHash;
}

export class TestBlocksInfo {
  static fromJson: FromJson<TestBlocksInfo> = {
    header_hash: commonFromJson.bytes32(),
    mmr: {
      peaks: json.array(json.nullable(commonFromJson.bytes32())),
    },
    state_root: commonFromJson.bytes32(),
    reported: json.array(TestReportedWorkPackage.fromJson),
  };

  header_hash!: HeaderHash;
  mmr!: {
    peaks: Array<OpaqueHash | null>;
  };
  state_root!: StateRootHash;
  reported!: TestReportedWorkPackage[];
}
