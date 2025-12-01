import type { CodeHash, ServiceId } from "@typeberry/block";
import type { RefineContext } from "@typeberry/block/refine-context.js";
import type { WorkItem } from "@typeberry/block/work-item.js";
import { tryAsWorkItemsCount, WorkPackage } from "@typeberry/block/work-package.js";
import { fromJson, refineContextFromJson } from "@typeberry/block-json";
import { BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { type FromJson, json } from "@typeberry/json-parser";
import { Compatibility, GpVersion, TestSuite } from "@typeberry/utils";
import type { RunOptions } from "../../common.js";
import { runCodecTest } from "./common.js";
import { workItemFromJson } from "./work-item.js";

type Authorizer = {
  code_hash: CodeHash;
  params: BytesBlob;
};

const authorizerFromJson: FromJson<Authorizer> = {
  code_hash: fromJson.bytes32(),
  params: json.fromString(BytesBlob.parseBlob),
};

export const workPackageFromJson =
  Compatibility.isSuite(TestSuite.W3F, GpVersion.V0_7_0) || Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
    ? json.object<JsonWorkPackage, WorkPackage>(
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
      )
    : json.object<JsonWorkPackagePre071, WorkPackage>(
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

type JsonWorkPackagePre071 = {
  authorization: BytesBlob;
  auth_code_host: ServiceId;
  authorizer: Authorizer;
  context: RefineContext;
  items: WorkItem[];
};

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
