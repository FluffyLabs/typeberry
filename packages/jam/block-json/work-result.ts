import { type CodeHash, tryAsServiceGas } from "@typeberry/block";
import type { ServiceGas, ServiceId } from "@typeberry/block";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { BytesBlob } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import { type U32, tryAsU32 } from "@typeberry/numbers";
import { fromJson } from "./common.js";

// TODO [ToDr] Introduce fromJson.union?
const workExecResultFromJson = json.object<JsonWorkExecResult, WorkExecResult>(
  {
    ok: json.optional(json.fromString(BytesBlob.parseBlob)),
    out_of_gas: json.optional(json.fromAny(() => null)),
    panic: json.optional(json.fromAny(() => null)),
    bad_code: json.optional(json.fromAny(() => null)),
    code_oversize: json.optional(json.fromAny(() => null)),
  },
  (val) => {
    const { ok, out_of_gas, panic, bad_code, code_oversize } = val;
    if (ok !== undefined) {
      return new WorkExecResult(tryAsU32(WorkExecResultKind.ok), ok);
    }
    if (out_of_gas === null) {
      return new WorkExecResult(tryAsU32(WorkExecResultKind.outOfGas));
    }
    if (panic === null) {
      return new WorkExecResult(tryAsU32(WorkExecResultKind.panic));
    }
    if (bad_code === null) {
      return new WorkExecResult(tryAsU32(WorkExecResultKind.badCode));
    }
    if (code_oversize === null) {
      return new WorkExecResult(tryAsU32(WorkExecResultKind.codeOversize));
    }

    throw new Error("Invalid WorkExecResult");
  },
);

type JsonWorkExecResult = {
  ok?: BytesBlob;
  out_of_gas?: null;
  panic?: null;
  bad_code?: null;
  code_oversize?: null;
};

const workRefineLoadFromJson = json.object<JsonWorkRefineLoad, WorkRefineLoad>(
  {
    gas_used: json.fromNumber((x) => tryAsServiceGas(x)),
    imports: "number",
    extrinsic_count: "number",
    extrinsic_size: "number",
    exports: "number",
  },
  ({ gas_used, imports, extrinsic_count, extrinsic_size, exports }) =>
    WorkRefineLoad.create({
      gasUsed: tryAsServiceGas(gas_used),
      importedSegments: tryAsU32(imports),
      extrinsicCount: tryAsU32(extrinsic_count),
      extrinsicSize: tryAsU32(extrinsic_size),
      exportedSegments: tryAsU32(exports),
    }),
);

type JsonWorkRefineLoad = {
  gas_used: ServiceGas;
  imports: U32;
  extrinsic_count: U32;
  extrinsic_size: U32;
  exports: U32;
};

export const workResultFromJson = json.object<JsonWorkResult, WorkResult>(
  {
    service_id: "number",
    code_hash: fromJson.bytes32(),
    payload_hash: fromJson.bytes32(),
    accumulate_gas: json.fromNumber((x) => tryAsServiceGas(x)),
    result: workExecResultFromJson,
    refine_load: workRefineLoadFromJson,
  },
  ({ service_id, code_hash, payload_hash, accumulate_gas, result, refine_load }) =>
    WorkResult.create({
      serviceId: service_id,
      codeHash: code_hash,
      payloadHash: payload_hash,
      gas: accumulate_gas,
      result,
      load: refine_load,
    }),
);

type JsonWorkResult = {
  service_id: ServiceId;
  code_hash: CodeHash;
  payload_hash: OpaqueHash;
  accumulate_gas: ServiceGas;
  result: WorkExecResult;
  refine_load: WorkRefineLoad;
};
