import { type Bytes, BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import { type ServiceId, bytes32, logger } from ".";
import { RefineContext } from "./refine_context";
import { WorkItem } from "./work_item";

class Authorizer {
  static fromJson = json.object<Authorizer>(
    {
      code_hash: bytes32(),
      params: json.fromString(BytesBlob.parseBlob),
    },
    (x) => Object.assign(new Authorizer(), x),
  );

  code_hash!: Bytes<32>;
  params!: BytesBlob;
}

export class WorkPackage {
  static fromJson = json.object<WorkPackage>(
    {
      authorization: json.fromString(BytesBlob.parseBlob),
      auth_code_host: "number",
      authorizer: Authorizer.fromJson,
      context: RefineContext.fromJson,
      // TODO [ToDr] should we have a validator to make sure the length is okay?
      items: json.array(WorkItem.fromJson),
    },
    (x) => Object.assign(new WorkPackage(), x),
  );

  authorization!: BytesBlob;
  auth_code_host!: ServiceId;
  authorizer!: Authorizer;
  context!: RefineContext;
  items!: FixedSizeArray<WorkItem, 1 | 2 | 3 | 4>;

  private constructor() {}
}

export async function runWorkPackageTest(test: WorkPackage, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
