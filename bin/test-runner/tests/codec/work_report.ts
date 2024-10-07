import { type Bytes, BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { U32 } from "@typeberry/numbers";
import { type CoreIndex, bytes32, logger } from ".";
import { RefineContext } from "./refine_context";
import { WorkResult } from "./work_result";

class WorkPackageSpec {
  static fromJson = json.object<WorkPackageSpec>(
    {
      hash: bytes32(),
      len: "number",
      erasure_root: bytes32(),
      exports_root: bytes32(),
    },
    (x) => Object.assign(new WorkPackageSpec(), x),
  );

  hash!: Bytes<32>;
  len!: U32;
  erasure_root!: Bytes<32>;
  exports_root!: Bytes<32>;

  private constructor() {}
}

export class WorkReport {
  static fromJson = json.object<WorkReport>(
    {
      package_spec: WorkPackageSpec.fromJson,
      context: RefineContext.fromJson,
      core_index: "number",
      authorizer_hash: bytes32(),
      auth_output: json.fromString(BytesBlob.parseBlob),
      results: json.array(WorkResult.fromJson),
    },
    (x) => Object.assign(new WorkReport(), x),
  );

  package_spec!: WorkPackageSpec;
  context!: RefineContext;
  core_index!: CoreIndex;
  authorizer_hash!: Bytes<32>;
  auth_output!: BytesBlob;
  results!: FixedSizeArray<WorkResult, 1 | 2 | 3 | 4>;

  private constructor() {}
}

export async function runWorkReportTest(test: WorkReport, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
