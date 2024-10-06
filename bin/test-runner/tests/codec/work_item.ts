import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import type { TrieHash } from "@typeberry/trie";
import type { Opaque } from "@typeberry/utils";
import { type Gas, type ServiceId, bytes32, logger } from ".";

type ExtrinsicHash = Opaque<Bytes<32>, "ExtrinsicHash">;

class ImportSpec {
  static fromJson: FromJson<ImportSpec> = {
    tree_root: bytes32(),
    index: "number",
  };

  tree_root!: TrieHash;
  index!: number; // u16
}

class ExtrinsicSpec {
  static fromJson: FromJson<ExtrinsicSpec> = {
    hash: bytes32(),
    len: "number",
  };

  hash!: ExtrinsicHash;
  len!: number; // u32
}

export class WorkItem {
  static fromJson: FromJson<WorkItem> = {
    service: json.castNumber(),
    code_hash: bytes32(),
    payload: json.fromString(BytesBlob.parseBlob),
    gas_limit: json.castNumber(),
    import_segments: json.array(ImportSpec.fromJson),
    extrinsic: json.array(ExtrinsicSpec.fromJson),
    export_count: "number",
  };

  service!: ServiceId;
  code_hash!: Bytes<32>;
  payload!: BytesBlob;
  gas_limit!: Gas;
  import_segments!: ImportSpec[];
  extrinsic!: ExtrinsicSpec[];
  export_count!: number; //u16

  private constructor() {}
}

export async function runWorkItemTest(test: WorkItem, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
