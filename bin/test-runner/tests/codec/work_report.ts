import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { type CoreIndex, bytes32, logger } from ".";
import { RefineContext } from "./refine_context";
import { WorkResult } from "./work_result";

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

export class WorkReport {
  static fromJson: FromJson<WorkReport> = {
    package_spec: WorkPackageSpec.fromJson,
    context: RefineContext.fromJson,
    core_index: json.castNumber(),
    authorizer_hash: bytes32(),
    auth_output: json.fromString(BytesBlob.parseBlob),
    results: json.array(WorkResult.fromJson),
  };

  package_spec!: WorkPackageSpec;
  context!: RefineContext;
  core_index!: CoreIndex;
  authorizer_hash!: Bytes<32>;
  auth_output!: BytesBlob;
  results!: WorkResult[]; // 1...4

  private constructor() {}
}

export async function runWorkReportTest(test: WorkReport, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
