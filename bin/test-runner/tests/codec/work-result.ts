import type { CodeHash } from "@typeberry/block";
import type { ServiceGas, ServiceId } from "@typeberry/block";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { BytesBlob } from "@typeberry/bytes";
import type { OpaqueHash } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import { tryAsU32 } from "@typeberry/numbers";
import { fromJson, runCodecTest } from "./common";

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
    if (ok) {
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

export const workResultFromJson = json.object<JsonWorkResult, WorkResult>(
  {
    service_id: "number",
    code_hash: fromJson.bytes32(),
    payload_hash: fromJson.bytes32(),
    accumulate_gas: "number",
    result: workExecResultFromJson,
  },
  ({ service_id, code_hash, payload_hash, accumulate_gas, result }) =>
    new WorkResult(service_id, code_hash, payload_hash, BigInt(accumulate_gas) as ServiceGas, result),
);

type JsonWorkResult = {
  service_id: ServiceId;
  code_hash: CodeHash;
  payload_hash: OpaqueHash;
  // TODO [ToDr] We don't have enough precision here for full bigint so 🤞
  // otherwise we will need to use a custom JSON parser.
  accumulate_gas: number;
  result: WorkExecResult;
};

export async function runWorkResultTest(test: WorkResult, file: string) {
  runCodecTest(WorkResult.Codec, test, file);
}
