import { json } from "@typeberry/json-parser";

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
} from "@typeberry/block";
import type { PreimageHash } from "@typeberry/block/preimage";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import { type WorkItemsCount, tryAsWorkItemsCount } from "@typeberry/block/work-package";
import {
  type AuthorizerHash,
  type ExportsRootHash,
  type WorkPackageHash,
  WorkPackageInfo,
  WorkPackageSpec,
  WorkReport,
} from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { Encoder } from "@typeberry/codec";
import { FixedSizeArray, HashDictionary } from "@typeberry/collections";
import { fullChainSpec, tinyChainSpec } from "@typeberry/config";
import { type HASH_SIZE, type OpaqueHash, WithHash, blake2b } from "@typeberry/hash";
import { type U16, type U32, type U64, tryAsU64 } from "@typeberry/numbers";
import type { SmallGas } from "@typeberry/pvm-interpreter";
import {
  AvailabilityAssignment,
  type BlockState,
  PreimageItem,
  Service,
  ServiceAccountInfo,
  VALIDATOR_META_BYTES,
  ValidatorData,
} from "@typeberry/state";
import { Bytes, BytesBlob } from "@typeberry/trie";
import { asOpaqueType } from "@typeberry/utils";
import { fromJson as codecFromJson } from "./codec/common";

/***
 * POTRZEBUJE WCZYTYWANIE JSONÓW PRZESUNĄĆ DO JAKIEJŚ PACZKI.
 *
 * packages/jam/block-json ?
 */

export namespace commonFromJson {
  export function bytes32<TInto extends Bytes<32>>() {
    return json.fromString((v) => Bytes.parseBytes(v, 32) as TInto);
  }

  export const validatorData = json.object<ValidatorData>(
    {
      ed25519: bytes32(),
      bandersnatch: bytes32(),
      bls: json.fromString((v) => Bytes.parseBytes(v, BLS_KEY_BYTES) as BlsKey),
      metadata: json.fromString((v) => Bytes.parseBytes(v, VALIDATOR_META_BYTES)),
    },
    ({ ed25519, bandersnatch, bls, metadata }) => new ValidatorData(bandersnatch, ed25519, bls, metadata),
  );
}

export function getChainSpec(path: string) {
  if (path.includes("tiny")) {
    return tinyChainSpec;
  }

  return fullChainSpec;
}

class TestWorkExecResult {
  static fromJson = json.object<TestWorkExecResult, WorkExecResult>(
    {
      ok: json.fromString(BytesBlob.parseBlob),
    },
    ({ ok }) => {
      return new WorkExecResult(WorkExecResultKind.ok, ok);
    },
  );

  ok!: BytesBlob | null;
}

class TestResult {
  static fromJson = json.object<TestResult, WorkResult>(
    {
      service_id: "number",
      code_hash: codecFromJson.bytes32(),
      payload_hash: codecFromJson.bytes32(),
      accumulate_gas: json.fromNumber((x) => asOpaqueType(tryAsU64(x))),
      result: TestWorkExecResult.fromJson,
    },
    ({ service_id, code_hash, payload_hash, accumulate_gas, result }) => {
      return new WorkResult(service_id, code_hash, payload_hash, accumulate_gas, result);
    },
  );

  service_id!: ServiceId;
  code_hash!: CodeHash;
  payload_hash!: Bytes<HASH_SIZE>;
  accumulate_gas!: ServiceGas;
  result!: WorkExecResult;
}

class TestPackageSpec {
  static fromJson = json.object<TestPackageSpec, WorkPackageSpec>(
    {
      hash: codecFromJson.bytes32(),
      length: "number",
      erasure_root: codecFromJson.bytes32(),
      exports_root: codecFromJson.bytes32(),
      exports_count: "number",
    },
    ({ hash, length, erasure_root, exports_root, exports_count }) => {
      return new WorkPackageSpec(hash, length, erasure_root, exports_root, exports_count);
    },
  );

  hash!: WorkPackageHash;
  length!: U32;
  erasure_root!: OpaqueHash;
  exports_root!: ExportsRootHash;
  exports_count!: U16;
}

class TestContext {
  static fromJson = json.object<TestContext, RefineContext>(
    {
      anchor: codecFromJson.bytes32(),
      state_root: codecFromJson.bytes32(),
      beefy_root: codecFromJson.bytes32(),
      lookup_anchor: codecFromJson.bytes32(),
      lookup_anchor_slot: "number",
      prerequisites: json.array(codecFromJson.bytes32()),
    },
    ({ anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisites }) => {
      return new RefineContext(anchor, state_root, beefy_root, lookup_anchor, lookup_anchor_slot, prerequisites);
    },
  );

  anchor!: HeaderHash;
  state_root!: StateRootHash;
  beefy_root!: BeefyHash;
  lookup_anchor!: HeaderHash;
  lookup_anchor_slot!: TimeSlot;
  prerequisites!: WorkPackageHash[];
}

export class TestSegmentRootLookupItem {
  static fromJson = json.object<TestSegmentRootLookupItem, WorkPackageInfo>(
    {
      work_package_hash: codecFromJson.bytes32(),
      segment_tree_root: codecFromJson.bytes32(),
    },
    ({ work_package_hash, segment_tree_root }) => new WorkPackageInfo(work_package_hash, segment_tree_root),
  );

  work_package_hash!: WorkPackageHash;
  segment_tree_root!: ExportsRootHash;
}

export class TestWorkReport {
  static fromJson = json.object<TestWorkReport, WorkReport>(
    {
      package_spec: TestPackageSpec.fromJson,
      context: TestContext.fromJson,
      core_index: "number",
      authorizer_hash: codecFromJson.bytes32(),
      auth_output: json.fromString(BytesBlob.parseBlob),
      segment_root_lookup: json.array(TestSegmentRootLookupItem.fromJson),
      results: json.array(TestResult.fromJson),
    },
    ({ package_spec, context, core_index, authorizer_hash, auth_output, segment_root_lookup, results }) => {
      const fixedSizeResults = FixedSizeArray.new(results, tryAsWorkItemsCount(results.length));
      return new WorkReport(
        package_spec,
        context,
        core_index,
        authorizer_hash,
        auth_output,
        segment_root_lookup,
        fixedSizeResults,
      );
    },
  );

  package_spec!: WorkPackageSpec;
  context!: RefineContext;
  core_index!: CoreIndex;
  authorizer_hash!: AuthorizerHash;
  auth_output!: BytesBlob;
  segment_root_lookup!: WorkPackageInfo[];
  results!: FixedSizeArray<WorkResult, WorkItemsCount>;
}

export class TestAvailabilityAssignment {
  static fromJson = json.object<TestAvailabilityAssignment, AvailabilityAssignment>(
    {
      report: TestWorkReport.fromJson,
      timeout: "number",
    },
    ({ report, timeout }) => {
      const workReportHash = blake2b.hashBytes(Encoder.encodeObject(WorkReport.Codec, report)).asOpaque();
      return new AvailabilityAssignment(new WithHash(workReportHash, report), timeout);
    },
  );

  report!: WorkReport;
  timeout!: TimeSlot;
}

export class TestWorkPackageInfo {
  static fromJson = json.object<TestWorkPackageInfo, WorkPackageInfo>(
    {
      hash: commonFromJson.bytes32(),
      exports_root: commonFromJson.bytes32(),
    },
    ({ hash, exports_root }) => {
      return new WorkPackageInfo(hash, exports_root);
    },
  );

  hash!: WorkPackageHash;
  exports_root!: ExportsRootHash;
}

export class TestBlockState {
  static fromJson = json.object<TestBlockState, BlockState>(
    {
      header_hash: commonFromJson.bytes32(),
      mmr: {
        peaks: json.array(json.nullable(commonFromJson.bytes32())),
      },
      state_root: commonFromJson.bytes32(),
      reported: json.array(TestWorkPackageInfo.fromJson),
    },
    ({ header_hash, mmr, state_root, reported }) => {
      return {
        headerHash: header_hash,
        mmr,
        postStateRoot: state_root,
        reported: HashDictionary.fromEntries(reported.map((x) => [x.workPackageHash, x])),
      };
    },
  );

  header_hash!: HeaderHash;
  mmr!: {
    peaks: Array<OpaqueHash | null>;
  };
  state_root!: StateRootHash;
  reported!: WorkPackageInfo[];
}

export class TestServiceInfo {
  static fromJson = json.object<TestServiceInfo, ServiceAccountInfo>(
    {
      code_hash: commonFromJson.bytes32(),
      balance: json.fromNumber((x) => tryAsU64(x)),
      min_item_gas: "number",
      min_memo_gas: "number",
      bytes: json.fromNumber((x) => tryAsU64(x)),
      items: "number",
    },
    ({ code_hash, balance, min_item_gas, min_memo_gas, bytes, items }) => {
      return ServiceAccountInfo.fromCodec({
        codeHash: code_hash,
        balance,
        accumulateMinGas: min_item_gas,
        onTransferMinGas: min_memo_gas,
        storageUtilisationBytes: bytes,
        storageUtilisationCount: items,
      });
    },
  );

  code_hash!: CodeHash;
  balance!: U64;
  min_item_gas!: SmallGas;
  min_memo_gas!: SmallGas;
  bytes!: U64;
  items!: U32;
}

export class TestPreimageItem {
  static fromJson = json.object<TestPreimageItem, PreimageItem>(
    {
      hash: commonFromJson.bytes32(),
      blob: json.fromString(BytesBlob.parseBlob),
    },
    ({ hash, blob }) => new PreimageItem(hash, blob),
  );

  hash!: PreimageHash;
  blob!: BytesBlob;
}

export class TestAccountItem {
  static fromJson = json.object<TestAccountItem, Service>(
    {
      id: "number",
      data: {
        service: TestServiceInfo.fromJson,
        preimages: json.optional(json.array(TestPreimageItem.fromJson)),
      },
    },
    ({ id, data }) =>
      new Service(id, {
        info: data.service,
        preimages: data.preimages ?? [],
        storage: [],
        lookupHistory: [],
      }),
  );

  id!: ServiceId;
  data!: { service: ServiceAccountInfo; preimages?: TestPreimageItem[] };
}
