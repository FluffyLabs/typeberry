import type { CodeHash, ServiceId } from "@typeberry/block";
import { fromJson, refineContextFromJson } from "@typeberry/block-json";
import type { RefineContext } from "@typeberry/block/refine-context";
import type { WorkItem } from "@typeberry/block/work-item";
import { WorkPackage, tryAsWorkItemsCount } from "@typeberry/block/work-package";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import { runCodecTest } from "./common";
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
    WorkPackage.create({
      authorization,
      authCodeHost: auth_code_host,
      authCodeHash: authorizer.code_hash,
      parametrization: authorizer.params,
      context,
      items: FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
    }),
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
