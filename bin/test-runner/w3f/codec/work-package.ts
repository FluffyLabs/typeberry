import type { CodeHash, ServiceId } from "@typeberry/block";
import type { RefineContext } from "@typeberry/block/refine-context";
import type { WorkItem } from "@typeberry/block/work-item";
import { WorkPackage, tryAsWorkItemsCount } from "@typeberry/block/work-package";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from "./common";
import { refineContextFromJson } from "./refine-context";
import { workItemFromJson } from "./work-item";

type Authorizer = {
  code_hash: CodeHash;
  params: BytesBlob;
};

const authorizerFromJson: FromJson<Authorizer> = {
  code_hash: fromJson.bytes32(),
  params: json.fromString(BytesBlob.parseBlob),
};

export const workPackageFromJson = json.object<JsonWorkPackage, WorkPackage>(
  {
    authorization: json.fromString(BytesBlob.parseBlob),
    auth_code_host: "number",
    authorizer: authorizerFromJson,
    context: refineContextFromJson,
    items: json.array(workItemFromJson),
  },
  ({ authorization, auth_code_host, authorizer, context, items }) =>
    new WorkPackage(
      authorization,
      auth_code_host,
      authorizer.code_hash,
      authorizer.params,
      context,
      FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
    ),
);

type JsonWorkPackage = {
  authorization: BytesBlob;
  auth_code_host: ServiceId;
  authorizer: Authorizer;
  context: RefineContext;
  items: WorkItem[];
};

export async function runWorkPackageTest(test: WorkPackage, file: string) {
  runCodecTest(WorkPackage.Codec, test, file);
}
