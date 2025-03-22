import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsCoreIndex, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { ServiceGas, ServiceId } from "@typeberry/block";
import { ED25519_SIGNATURE_BYTES, type Ed25519Signature } from "@typeberry/block/crypto";
import { Credential } from "@typeberry/block/guarantees";
import { RefineContext } from "@typeberry/block/refine-context";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report";
import { WorkExecResult, WorkExecResultKind, WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { MessageHandler, type MessageSender } from "../handler";
import { ClientHandler, GuaranteedWorkReport, STREAM_KIND, ServerHandler } from "./ce-135-work-report-distribution";

const MOCK_SLOT = tryAsTimeSlot(1000);
const MOCK_WORK_PACKAGE_SPEC = new WorkPackageSpec(
  Bytes.zero(HASH_SIZE).asOpaque(),
  tryAsU32(100),
  Bytes.zero(HASH_SIZE),
  Bytes.zero(HASH_SIZE).asOpaque(),
  tryAsU16(0),
);
const MOCK_CONTEXT = new RefineContext(
  Bytes.zero(HASH_SIZE).asOpaque(),
  Bytes.zero(HASH_SIZE).asOpaque(),
  Bytes.zero(HASH_SIZE).asOpaque(),
  Bytes.zero(HASH_SIZE).asOpaque(),
  tryAsTimeSlot(1),
);
const MOCK_WORK_RESULT = new WorkResult(
  tryAsU32(1) as ServiceId,
  Bytes.zero(HASH_SIZE).asOpaque(),
  Bytes.zero(HASH_SIZE),
  tryAsU64(1000n) as ServiceGas,
  new WorkExecResult(WorkExecResultKind.ok, BytesBlob.blobFrom(new Uint8Array())),
);
const MOCK_WORK_REPORT = new WorkReport(
  MOCK_WORK_PACKAGE_SPEC,
  MOCK_CONTEXT,
  tryAsCoreIndex(0),
  Bytes.zero(HASH_SIZE).asOpaque(),
  BytesBlob.blobFrom(new Uint8Array()),
  [],
  FixedSizeArray.new([MOCK_WORK_RESULT], tryAsWorkItemsCount(1)),
);
const MOCK_SIGNATURES = asKnownSize([
  new Credential(tryAsValidatorIndex(0), Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque() as Ed25519Signature),
  new Credential(tryAsValidatorIndex(1), Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque() as Ed25519Signature),
]);
const MOCK_GUARANTEED_WORK_REPORT = new GuaranteedWorkReport(MOCK_WORK_REPORT, MOCK_SLOT, MOCK_SIGNATURES);

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
      const serverHandler = new ServerHandler((workReport) => {
        assert.deepStrictEqual(workReport, MOCK_GUARANTEED_WORK_REPORT);
        resolve(undefined);
      });

      handlers.server.registerHandlers(serverHandler);
      handlers.client.registerHandlers(new ClientHandler());

      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler.sendWorkReport(sender, MOCK_GUARANTEED_WORK_REPORT);
      });
    });
  });
});
