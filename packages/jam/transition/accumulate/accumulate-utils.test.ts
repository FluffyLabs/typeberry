import assert from "node:assert";
import { before, describe, it } from "node:test";
import { type EntropyHash, tryAsCoreIndex, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { RefineContext, type WorkPackageHash } from "@typeberry/block/refine-context.js";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkExecResultKind, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { FixedSizeArray, HashSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { Blake2b, HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { Compatibility, deepEqual, GpVersion } from "@typeberry/utils";
import { generateNextServiceId, getWorkPackageHashes, uniquePreserveOrder } from "./accumulate-utils.js";

let blake2b: Blake2b;

before(async () => {
  blake2b = await Blake2b.createHasher();
});

describe("accumulate-utils", () => {
  describe("uniquePreserveOrder", () => {
    it("should remove duplicates without changing order", () => {
      const input = [1, 1, 2, 3, 2, 3, 4, 5];
      const expectedOutput = [1, 2, 3, 4, 5];

      const output = uniquePreserveOrder(input);

      deepEqual(output, expectedOutput);
    });
  });

  describe("getWorkPackageHashes", () => {
    const createWorkReportHash = (i: number): WorkPackageHash => Bytes.fill(HASH_SIZE, i).asOpaque();

    const createWorkReport = (workPackageHash: WorkPackageHash) =>
      WorkReport.create({
        authorizationGasUsed: tryAsServiceGas(0n),
        authorizationOutput: BytesBlob.empty(),
        authorizerHash: Bytes.zero(HASH_SIZE).asOpaque(),
        context: RefineContext.create({
          anchor: Bytes.zero(HASH_SIZE).asOpaque(),
          beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          lookupAnchor: Bytes.zero(HASH_SIZE).asOpaque(),
          lookupAnchorSlot: tryAsTimeSlot(0),
          prerequisites: [],
          stateRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        }),
        coreIndex: tryAsCoreIndex(0),
        results: FixedSizeArray.new(
          [
            WorkResult.create({
              codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
              gas: tryAsServiceGas(0),
              load: WorkRefineLoad.create({
                gasUsed: tryAsServiceGas(0),
                exportedSegments: tryAsU32(0),
                extrinsicCount: tryAsU32(0),
                extrinsicSize: tryAsU32(0),
                importedSegments: tryAsU32(0),
              }),
              payloadHash: Bytes.zero(HASH_SIZE).asOpaque(),
              result: new WorkExecResult(WorkExecResultKind.ok, BytesBlob.empty()),
              serviceId: tryAsServiceId(0),
            }),
          ],
          tryAsWorkItemsCount(1),
        ),
        segmentRootLookup: [],
        workPackageSpec: WorkPackageSpec.create({
          erasureRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          exportsCount: tryAsU16(0),
          exportsRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          hash: workPackageHash,
          length: tryAsU32(0),
        }),
      });

    it("should map work reports to work package hashes", () => {
      const hashes = [0, 1, 2, 3, 4, 5].map(createWorkReportHash);
      const reports = hashes.map(createWorkReport);
      const expectedHashSet = HashSet.from(hashes);

      const result = getWorkPackageHashes(reports);

      deepEqual(result, expectedHashSet);
    });
  });

  describe("generateNextServiceId", () => {
    it("should generate next service id correctly", () => {
      const serviceId = tryAsServiceId(5);
      const entropy: EntropyHash = Bytes.fill(HASH_SIZE, 4).asOpaque();
      const timeslot = tryAsTimeSlot(6);
      const expectedServiceId = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
        ? tryAsServiceId(2596254713)
        : tryAsServiceId(2596189433);

      const result = generateNextServiceId({ serviceId, entropy, timeslot }, tinyChainSpec, blake2b);

      assert.strictEqual(result, expectedServiceId);
    });
  });
});
