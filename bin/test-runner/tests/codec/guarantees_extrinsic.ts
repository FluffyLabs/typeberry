import { type Bytes, BytesBlob } from "@typeberry/bytes";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import {
  type Ed25519Signature,
  type HeaderHash,
  type Slot,
  type ValidatorIndex,
  bytes32,
  ed25519SignatureFromJson,
  logger,
} from ".";
import { ARRAY, CAST_NUMBER, FROM_ANY, FROM_STRING, type FromJson, OPTIONAL } from "../../json-parser";

type ServiceId = Opaque<number, "ServiceId[u32]">;
// TODO [ToDr] we don't have enough precision here so 🤞
type Gas = Opaque<number, "Gas[u64]">;
type CoreIndex = Opaque<number, "CoreIndex[u16]">;

type BeefyHash = Opaque<Bytes<32>, "BeefyHash">;

class RefineContext {
  static fromJson: FromJson<RefineContext> = {
    anchor: bytes32<HeaderHash>(),
    state_root: bytes32<TrieHash>(),
    beefy_root: bytes32<BeefyHash>(),
    lookup_anchor: bytes32<HeaderHash>(),
    lookup_anchor_slot: CAST_NUMBER<Slot>(),
    prerequisite: OPTIONAL(bytes32()),
  };

  anchor!: HeaderHash;
  state_root!: TrieHash;
  beefy_root!: BeefyHash;
  lookup_anchor!: HeaderHash;
  lookup_anchor_slot!: Slot;
  prerequisite?: Bytes<32>;

  private constructor() {}
}

class WorkExecResult {
  // TODO [ToDr] Introduce fromJson.union?
  static fromJson: FromJson<WorkExecResult> = {
    ok: OPTIONAL(FROM_STRING(BytesBlob.parseBlob)),
    out_of_gas: OPTIONAL(FROM_ANY(() => null)),
    panic: OPTIONAL(FROM_ANY(() => null)),
    bad_code: OPTIONAL(FROM_ANY(() => null)),
    code_oversize: OPTIONAL(FROM_ANY(() => null)),
  };
  ok?: BytesBlob;
  out_of_gas?: null;
  panic?: null;
  bad_code?: null;
  code_oversize?: null;

  private constructor() {}
}

class WorkPackageSpec {
  static fromJson: FromJson<WorkPackageSpec> = {
    hash: bytes32(),
    len: "number",
    erasure_root: bytes32(),
    exports_root: bytes32(),
  };

  hash!: Bytes<32>;
  len!: number; // u32
  erasure_root!: Bytes<32>;
  exports_root!: Bytes<32>;

  private constructor() {}
}

class WorkResult {
  static fromJson: FromJson<WorkResult> = {
    service: CAST_NUMBER<ServiceId>(),
    code_hash: bytes32(),
    payload_hash: bytes32(),
    gas_ratio: CAST_NUMBER<Gas>(),
    result: WorkExecResult.fromJson,
  };
  service!: ServiceId;
  code_hash!: Bytes<32>;
  payload_hash!: Bytes<32>;
  gas_ratio!: Gas;
  result!: WorkExecResult;

  private constructor() {}
}

class WorkReport {
  static fromJson: FromJson<WorkReport> = {
    package_spec: WorkPackageSpec.fromJson,
    context: RefineContext.fromJson,
    core_index: CAST_NUMBER<CoreIndex>(),
    authorizer_hash: bytes32(),
    auth_output: FROM_STRING(BytesBlob.parseBlob),
    results: ARRAY(WorkResult.fromJson),
  };

  package_spec!: WorkPackageSpec;
  context!: RefineContext;
  core_index!: CoreIndex;
  authorizer_hash!: Bytes<32>;
  auth_output!: BytesBlob;
  results!: WorkResult[]; // 1...4

  private constructor() {}
}

class ValidatorSignature {
  static fromJson: FromJson<ValidatorSignature> = {
    validator_index: CAST_NUMBER<ValidatorIndex>(),
    signature: ed25519SignatureFromJson,
  };

  validator_index!: ValidatorIndex;
  signature!: Ed25519Signature;

  private constructor() {}
}

class ReportGuarantee {
  static fromJson: FromJson<ReportGuarantee> = {
    report: WorkReport.fromJson,
    slot: CAST_NUMBER<Slot>(),
    signatures: ARRAY(ValidatorSignature.fromJson),
  };
  report!: WorkReport;
  slot!: Slot;
  signatures!: ValidatorSignature[];

  private constructor() {}
}

export type GuaranteesExtrinsic = ReportGuarantee[];
export const GuaranteesExtrinsicFromJson = ARRAY(ReportGuarantee.fromJson);

export async function runGuaranteesExtrinsicTest(test: GuaranteesExtrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
