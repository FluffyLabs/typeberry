import assert from "node:assert";
import { describe, it } from "node:test";
import {
  type HeaderHash,
  type StateRootHash,
  tryAsCoreIndex,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { Credential } from "@typeberry/block/guarantees";
import { type BeefyHash, RefineContext } from "@typeberry/block/refine-context";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package";
import { type ExportsRootHash, type WorkPackageHash, WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/crypto";
import { HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { MessageHandler, type MessageSender } from "../handler";
import { ClientHandler, GuaranteedWorkReport, STREAM_KIND, ServerHandler } from "./ce-135-work-report-distribution";

const MOCK_SLOT = tryAsTimeSlot(1000);
const MOCK_WORK_PACKAGE_SPEC = WorkPackageSpec.create({
  hash: Bytes.zero(HASH_SIZE).asOpaque<WorkPackageHash>(),
  length: tryAsU32(100),
  erasureRoot: Bytes.zero(HASH_SIZE).asOpaque<OpaqueHash>(),
  exportsRoot: Bytes.zero(HASH_SIZE).asOpaque<ExportsRootHash>(),
  exportsCount: tryAsU16(0),
});
const MOCK_CONTEXT = RefineContext.create({
  anchor: Bytes.zero(HASH_SIZE).asOpaque<HeaderHash>(),
  stateRoot: Bytes.zero(HASH_SIZE).asOpaque<StateRootHash>(),
  beefyRoot: Bytes.zero(HASH_SIZE).asOpaque<BeefyHash>(),
  lookupAnchor: Bytes.zero(HASH_SIZE).asOpaque<HeaderHash>(),
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
    signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque<Ed25519Signature>(),
  }),
  Credential.create({
    validatorIndex: tryAsValidatorIndex(1),
    signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque<Ed25519Signature>(),
  }),
]);
const MOCK_GUARANTEED_WORK_REPORT = GuaranteedWorkReport.create({
  report: MOCK_WORK_REPORT,
  slot: MOCK_SLOT,
  signatures: MOCK_SIGNATURES,
});

class FakeMessageSender implements MessageSender {
  constructor(
    public readonly onMessage: (data: BytesBlob) => void,
    public readonly onClose: () => void,
  ) {}

  send(data: BytesBlob): void {
    setImmediate(() => {
      this.onMessage(data);
    });
  }

  close(): void {
    setImmediate(() => {
      this.onClose();
    });
  }
}

describe("CE 135: Work Report Distribution", () => {
  it("Guarantor sends a work report and validator receives it", async () => {
    const handlers = {} as { client: MessageHandler; server: MessageHandler };
    handlers.client = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.server.onSocketMessage(data.raw);
        },
        () => {
          handlers.server.onClose({});
        },
      ),
    );
    handlers.server = new MessageHandler(
      new FakeMessageSender(
        (data) => {
          handlers.client.onSocketMessage(data.raw);
        },
        () => {
          handlers.client.onClose({});
        },
      ),
    );

    await new Promise((resolve) => {
      const serverHandler = new ServerHandler(tinyChainSpec, (workReport) => {
        assert.deepStrictEqual(workReport, MOCK_GUARANTEED_WORK_REPORT);
        resolve(undefined);
      });

      handlers.server.registerHandlers(serverHandler);
      handlers.client.registerHandlers(new ClientHandler(tinyChainSpec));

      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler.sendWorkReport(sender, MOCK_GUARANTEED_WORK_REPORT);
      });
    });
  });
});
