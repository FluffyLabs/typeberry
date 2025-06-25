import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import { Credential } from "@typeberry/block/guarantees.js";
import { RefineContext } from "@typeberry/block/refine-context.js";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { OK } from "@typeberry/utils";
import { ClientHandler, GuaranteedWorkReport, STREAM_KIND, ServerHandler } from "./ce-135-work-report-distribution.js";
import { testClientServer } from "./test-utils.js";

const MOCK_SLOT = tryAsTimeSlot(1000);
const MOCK_WORK_PACKAGE_SPEC = WorkPackageSpec.create({
  hash: Bytes.zero(HASH_SIZE).asOpaque(),
  length: tryAsU32(100),
  erasureRoot: Bytes.zero(HASH_SIZE).asOpaque(),
  exportsRoot: Bytes.zero(HASH_SIZE).asOpaque(),
  exportsCount: tryAsU16(0),
});
const MOCK_CONTEXT = RefineContext.create({
  anchor: Bytes.zero(HASH_SIZE).asOpaque(),
  stateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
  beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
  lookupAnchor: Bytes.zero(HASH_SIZE).asOpaque(),
  lookupAnchorSlot: tryAsTimeSlot(1),
  prerequisites: [],
});
const MOCK_WORK_RESULT = WorkResult.create({
  serviceId: tryAsServiceId(1),
  codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
  payloadHash: Bytes.zero(HASH_SIZE),
  gas: tryAsServiceGas(1000n),
  result: new WorkExecResult(WorkExecResultKind.ok, BytesBlob.blobFrom(new Uint8Array())),
  load: WorkRefineLoad.create({
    gasUsed: tryAsServiceGas(10_000n),
    importedSegments: tryAsU32(1),
    exportedSegments: tryAsU32(1),
    extrinsicCount: tryAsU32(100),
    extrinsicSize: tryAsU32(100),
  }),
});
const MOCK_WORK_REPORT = WorkReport.create({
  workPackageSpec: MOCK_WORK_PACKAGE_SPEC,
  context: MOCK_CONTEXT,
  coreIndex: tryAsCoreIndex(0),
  authorizerHash: Bytes.zero(HASH_SIZE).asOpaque(),
  authorizationOutput: BytesBlob.blobFrom(new Uint8Array()),
  segmentRootLookup: [],
  results: FixedSizeArray.new([MOCK_WORK_RESULT], tryAsWorkItemsCount(1)),
  authorizationGasUsed: tryAsServiceGas(10_000n),
});
const MOCK_SIGNATURES = asKnownSize([
  Credential.create({
    validatorIndex: tryAsValidatorIndex(0),
    signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  }),
  Credential.create({
    validatorIndex: tryAsValidatorIndex(1),
    signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  }),
]);
const MOCK_GUARANTEED_WORK_REPORT = GuaranteedWorkReport.create({
  report: MOCK_WORK_REPORT,
  slot: MOCK_SLOT,
  signatures: MOCK_SIGNATURES,
});

describe("CE 135: Work Report Distribution", () => {
  it("Guarantor sends a work report and validator receives it", async () => {
    const handlers = testClientServer();

    await new Promise((resolve) => {
      const serverHandler = new ServerHandler(tinyChainSpec, (workReport) => {
        assert.deepStrictEqual(workReport, MOCK_GUARANTEED_WORK_REPORT);
        resolve(undefined);
      });

      handlers.server.registerHandlers(serverHandler);
      handlers.client.registerHandlers(new ClientHandler(tinyChainSpec));

      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler.sendWorkReport(sender, MOCK_GUARANTEED_WORK_REPORT);
        return OK;
      });
    });
  });
});
