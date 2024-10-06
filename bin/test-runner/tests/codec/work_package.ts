import { type Bytes, BytesBlob } from "@typeberry/bytes";
import { type FromJson, json } from "@typeberry/json-parser";
import { type ServiceId, bytes32, logger } from ".";
import { RefineContext } from "./refine_context";
import { WorkItem } from "./work_item";

class Authorizer {
  static fromJson: FromJson<Authorizer> = {
    code_hash: bytes32(),
    params: json.fromString(BytesBlob.parseBlob),
  };

  code_hash!: Bytes<32>;
  params!: BytesBlob;
}

export class WorkPackage {
  static fromJson: FromJson<WorkPackage> = {
    authorization: json.fromString(BytesBlob.parseBlob),
    auth_code_host: json.castNumber(),
    authorizer: Authorizer.fromJson,
    context: RefineContext.fromJson,
    items: json.array(WorkItem.fromJson),
  };

  authorization!: BytesBlob;
  auth_code_host!: ServiceId;
  authorizer!: Authorizer;
  context!: RefineContext;
  items!: WorkItem[]; // 1..4

  private constructor() {}
}

export async function runWorkPackageTest(test: WorkPackage, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
