import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import type { U16, U32 } from "@typeberry/numbers";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import { type Gas, type ServiceId, bytes32, logger } from ".";

type ExtrinsicHash = Opaque<Bytes<32>, "ExtrinsicHash">;

class ImportSpec {
  static fromJson = json.object<ImportSpec>(
    {
      tree_root: bytes32(),
      index: "number",
    },
    (x) => Object.assign(new ImportSpec(), x),
  );

  tree_root!: TrieHash;
  index!: U16;
}

class ExtrinsicSpec {
  static fromJson = json.object<ExtrinsicSpec>(
    {
      hash: bytes32(),
      len: "number",
    },
    (x) => Object.assign(new ExtrinsicSpec(), x),
  );

  hash!: ExtrinsicHash;
  len!: U32;
}

export class WorkItem {
  static fromJson = json.object<WorkItem>(
    {
      service: "number",
      code_hash: bytes32(),
      payload: json.fromString(BytesBlob.parseBlob),
      gas_limit: "number",
      import_segments: json.array(ImportSpec.fromJson),
      extrinsic: json.array(ExtrinsicSpec.fromJson),
      export_count: "number",
    },
    (x) => Object.assign(new WorkItem(), x),
  );

  service!: ServiceId;
  code_hash!: Bytes<32>;
  payload!: BytesBlob;
  gas_limit!: Gas;
  import_segments!: ImportSpec[];
  extrinsic!: ExtrinsicSpec[];
  export_count!: U16;

  private constructor() {}
}

export async function runWorkItemTest(test: WorkItem, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
