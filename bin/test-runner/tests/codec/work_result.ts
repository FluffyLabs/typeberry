import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { type Gas, type ServiceId, bytes32, logger } from ".";

class WorkExecResult {
  // TODO [ToDr] Introduce fromJson.union?
  static fromJson: FromJson<WorkExecResult> = {
    ok: json.optional(json.fromString(BytesBlob.parseBlob)),
    out_of_gas: json.optional(json.fromAny(() => null)),
    panic: json.optional(json.fromAny(() => null)),
    bad_code: json.optional(json.fromAny(() => null)),
    code_oversize: json.optional(json.fromAny(() => null)),
  };
  ok?: BytesBlob;
  out_of_gas?: null;
  panic?: null;
  bad_code?: null;
  code_oversize?: null;

  private constructor() {}
}

export class WorkResult {
  static fromJson: FromJson<WorkResult> = {
    service: json.castNumber(),
    code_hash: bytes32(),
    payload_hash: bytes32(),
    gas_ratio: json.castNumber(),
    result: WorkExecResult.fromJson,
  };
  service!: ServiceId;
  code_hash!: Bytes<32>;
  payload_hash!: Bytes<32>;
  gas_ratio!: Gas;
  result!: WorkExecResult;

  private constructor() {}
}

export async function runWorkResultTest(test: WorkResult, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
