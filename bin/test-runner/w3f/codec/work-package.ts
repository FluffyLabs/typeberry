import type { CodeHash, ServiceId } from "@typeberry/block";
import type { RefineContext } from "@typeberry/block/refine-context.js";
import type { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { fromJson, refineContextFromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { json } from "@typeberry/json-parser";
import type { RunOptions } from "../../common.js";
import { runCodecTest } from "./common.js";
import { workItemFromJson } from "./work-item.js";

export const workPackageFromJson = json.object<JsonWorkPackage, WorkPackage>(
  {
    authorization: json.fromString(BytesBlob.parseBlob),
    auth_code_host: "number",
    auth_code_hash: fromJson.bytes32(),
    authorizer_config: json.fromString(BytesBlob.parseBlob),
    context: refineContextFromJson,
    items: json.array(workItemFromJson),
  },
  ({ authorization, auth_code_host, auth_code_hash, authorizer_config, context, items }) =>
    WorkPackage.create({
      authorization,
      authCodeHost: auth_code_host,
      authCodeHash: auth_code_hash,
      parametrization: authorizer_config,
      context,
      items: FixedSizeArray.new(items, tryAsWorkItemsCount(items.length)),
    }),
);

type JsonWorkPackage = {
  authorization: BytesBlob;
  auth_code_host: ServiceId;
  auth_code_hash: CodeHash;
  authorizer_config: BytesBlob;
  context: RefineContext;
  items: WorkItem[];
};

export async function runWorkPackageTest(test: WorkPackage, { path: file }: RunOptions) {
  runCodecTest(WorkPackage.Codec, test, file);
}
