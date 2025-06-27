import assert from "node:assert";
import { describe, it } from "node:test";
import { tryAsCoreIndex } from "@typeberry/block";
import { WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { OK } from "@typeberry/utils";
import { ClientHandler, STREAM_KIND, ServerHandler } from "./ce-134-work-package-sharing.js";
import { testClientServer } from "./test-utils.js";

const MOCK_CORE_INDEX = tryAsCoreIndex(1);
const MOCK_SEGMENTS_ROOT_MAPPINGS = [
  WorkPackageInfo.create({
    workPackageHash: Bytes.zero(HASH_SIZE).asOpaque(),
    segmentTreeRoot: Bytes.zero(HASH_SIZE).asOpaque(),
  }),
];
const MOCK_WORK_PACKAGE_BUNDLE = BytesBlob.blobFromString("hello");
const MOCK_WORK_REPORT_HASH = Bytes.zero(HASH_SIZE).asOpaque();
const MOCK_SIGNATURE = Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque();

describe("CE 134: Work Package Sharing", () => {
  it("Client sends a work package and the server returns a work report hash", async () => {
    const handlers = testClientServer();

    await new Promise((resolve) => {
      const serverHandler = new ServerHandler((coreIndex, segmentsRootMappings, workPackageBundle) => {
        assert.deepStrictEqual(coreIndex, MOCK_CORE_INDEX);
        assert.deepStrictEqual(segmentsRootMappings, MOCK_SEGMENTS_ROOT_MAPPINGS);
        assert.deepStrictEqual(workPackageBundle, MOCK_WORK_PACKAGE_BUNDLE);

        return Promise.resolve({
          workReportHash: MOCK_WORK_REPORT_HASH,
          signature: MOCK_SIGNATURE,
        });
      });

      handlers.server.registerHandlers(serverHandler);
      handlers.client.registerHandlers(new ClientHandler());

      handlers.client.withNewStream(STREAM_KIND, (handler: ClientHandler, sender) => {
        handler
          .sendWorkPackage(sender, MOCK_CORE_INDEX, MOCK_SEGMENTS_ROOT_MAPPINGS, MOCK_WORK_PACKAGE_BUNDLE)
          .then(({ workReportHash, signature }) => {
            assert.deepStrictEqual(workReportHash, MOCK_WORK_REPORT_HASH);
            assert.deepStrictEqual(signature, MOCK_SIGNATURE);
            resolve(undefined);
          });
        return OK;
      });
    });
  });
});
