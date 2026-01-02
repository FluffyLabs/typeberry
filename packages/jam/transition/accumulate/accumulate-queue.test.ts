import { describe, it } from "node:test";
import { tryAsCoreIndex, tryAsPerEpochBlock, tryAsServiceGas, tryAsServiceId, tryAsTimeSlot } from "@typeberry/block";
import { RefineContext, type WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { tryAsWorkItemsCount } from "@typeberry/block/work-package.js";
import { WorkPackageSpec, WorkReport } from "@typeberry/block/work-report.js";
import { WorkExecResult, WorkRefineLoad, WorkResult } from "@typeberry/block/work-result.js";

import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize, FixedSizeArray, HashSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU16, tryAsU32 } from "@typeberry/numbers";
import { InMemoryState, NotYetAccumulatedReport, PrivilegedServices, tryAsPerCore } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { AccumulateQueue, pruneQueue } from "./accumulate-queue.js";

describe("accumulate-queue", () => {
  const createWorkReportHash = (i: number): WorkPackageHash => Bytes.fill(HASH_SIZE, i).asOpaque();

  const createWorkPackageInfo = (i: number): WorkPackageInfo =>
    WorkPackageInfo.create({
      segmentTreeRoot: Bytes.zero(HASH_SIZE).asOpaque(),
      workPackageHash: createWorkReportHash(i),
    });

  const createWorkReport = (
    workPackageHash: WorkPackageHash,
    prerequisites: WorkPackageHash[] = [],
    segmentRootLookup: WorkPackageInfo[] = [],
  ) =>
    WorkReport.create({
      authorizationGasUsed: tryAsServiceGas(0n),
      authorizationOutput: BytesBlob.empty(),
      authorizerHash: Bytes.zero(HASH_SIZE).asOpaque(),
      context: RefineContext.create({
        anchor: Bytes.zero(HASH_SIZE).asOpaque(),
        beefyRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        lookupAnchor: Bytes.zero(HASH_SIZE).asOpaque(),
        lookupAnchorSlot: tryAsTimeSlot(0),
        prerequisites,
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
            result: WorkExecResult.ok(BytesBlob.empty()),
            serviceId: tryAsServiceId(0),
          }),
        ],
        tryAsWorkItemsCount(1),
      ),
      segmentRootLookup,
      workPackageSpec: WorkPackageSpec.create({
        erasureRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        exportsCount: tryAsU16(0),
        exportsRoot: Bytes.zero(HASH_SIZE).asOpaque(),
        hash: workPackageHash,
        length: tryAsU32(0),
      }),
    });

  const createNotAccumulatedWorkReport = (
    workPackageHash: WorkPackageHash,
    dependencies: WorkPackageHash[] = [],
    prerequisites: WorkPackageHash[] = [],
    segmentRootLookup: WorkPackageInfo[] = [],
  ) =>
    NotYetAccumulatedReport.create({
      report: createWorkReport(workPackageHash, prerequisites, segmentRootLookup),
      dependencies: asKnownSize(dependencies),
    });

  describe("AccumulateQueue", () => {
    const createEmptyRecentlyAccumulated = (): HashSet<WorkPackageHash>[] => {
      const queue = new Array(tinyChainSpec.epochLength);
      queue.fill(HashSet.new());
      return queue;
    };

    const createEmptyAccumulationQueue = (): NotYetAccumulatedReport[][] => {
      const queue = new Array(tinyChainSpec.epochLength);
      queue.fill([]);
      return queue;
    };

    const createAccumulateQueue = (
      recentlyAccumulated: HashSet<WorkPackageHash>[] = createEmptyRecentlyAccumulated(),
      accumulationQueue: NotYetAccumulatedReport[][] = createEmptyAccumulationQueue(),
    ) =>
      new AccumulateQueue(
        tinyChainSpec,
        InMemoryState.partial(tinyChainSpec, {
          privilegedServices: PrivilegedServices.create({
            manager: tryAsServiceId(0),
            assigners: tryAsPerCore(new Array(tinyChainSpec.coresCount).fill(tryAsServiceId(0)), tinyChainSpec),
            delegator: tryAsServiceId(0),
            registrar: tryAsServiceId(0),
            autoAccumulateServices: new Map(),
          }),
          recentlyAccumulated: tryAsPerEpochBlock(recentlyAccumulated, tinyChainSpec),
          accumulationQueue: tryAsPerEpochBlock(accumulationQueue, tinyChainSpec),
          timeslot: tryAsTimeSlot(1),
        }),
      );

    describe("getWorkReportsToAccumulateImmediately", () => {
      it("should return reports without prerequisites", () => {
        const accumulationQueue = createAccumulateQueue();
        const reportsWithoutPrerequisitesAndSegments = [createWorkReport(createWorkReportHash(0))];
        const reportsWithPrerequisites = [createWorkReport(createWorkReportHash(1), [createWorkReportHash(2)])];
        const reports = [...reportsWithPrerequisites, ...reportsWithoutPrerequisitesAndSegments];

        const result = accumulationQueue.getWorkReportsToAccumulateImmediately(reports);

        deepEqual(result, reportsWithoutPrerequisitesAndSegments);
      });

      it("should return reports without segments", () => {
        const accumulationQueue = createAccumulateQueue();
        const reportsWithoutPrerequisitesAndSegments = [createWorkReport(createWorkReportHash(0))];
        const reportsWithSegments = [createWorkReport(createWorkReportHash(1), undefined, [createWorkPackageInfo(3)])];
        const reports = [...reportsWithoutPrerequisitesAndSegments, ...reportsWithSegments];

        const result = accumulationQueue.getWorkReportsToAccumulateImmediately(reports);

        deepEqual(result, reportsWithoutPrerequisitesAndSegments);
      });
    });

    describe("getWorkReportsToAccumulateLater", () => {
      it("should return report with prerequisites", () => {
        const accumulationQueue = createAccumulateQueue();
        const reportsWithoutPrerequisitesAndSegments = [createWorkReport(createWorkReportHash(0))];
        const prerequisites = [createWorkReportHash(2)];
        const reportsWithPrerequisites = [createWorkReport(createWorkReportHash(1), prerequisites)];
        const reports = [...reportsWithPrerequisites, ...reportsWithoutPrerequisitesAndSegments];
        const expectedReports = reportsWithPrerequisites.map((report) =>
          NotYetAccumulatedReport.create({ report, dependencies: asKnownSize(prerequisites) }),
        );

        const result = accumulationQueue.getWorkReportsToAccumulateLater(reports);

        deepEqual(result, expectedReports);
      });

      it("should return report with segments", () => {
        const accumulationQueue = createAccumulateQueue();
        const segments = [createWorkPackageInfo(3)];
        const segmentHashes = segments.map((segment) => segment.workPackageHash);
        const reportsWithoutPrerequisitesAndSegments = [createWorkReport(createWorkReportHash(0))];
        const reportsWithSegments = [createWorkReport(createWorkReportHash(1), undefined, segments)];
        const reports = [...reportsWithoutPrerequisitesAndSegments, ...reportsWithSegments];
        const expectedResult = reportsWithSegments.map((report) =>
          NotYetAccumulatedReport.create({ report, dependencies: asKnownSize(segmentHashes) }),
        );

        const result = accumulationQueue.getWorkReportsToAccumulateLater(reports);

        deepEqual(result, expectedResult);
      });

      it("should remove reports that were accumulate earlier", () => {
        const dependencies = [createWorkReportHash(5)];
        const reports = [0, 1, 2, 3].map((i) => createWorkReport(createWorkReportHash(i), dependencies));
        const history = [0, 1].map((i) => createWorkReportHash(i));
        const recentlyAccumulated = createEmptyRecentlyAccumulated();
        recentlyAccumulated[0].insertAll(history);
        const accumulationQueue = createAccumulateQueue(recentlyAccumulated);
        const expectedReports = reports
          .slice(2)
          .map((report) => NotYetAccumulatedReport.create({ report, dependencies: asKnownSize(dependencies) }));

        const result = accumulationQueue.getWorkReportsToAccumulateLater(reports);

        deepEqual(result, expectedReports);
      });
    });

    describe("enqueueReports", () => {
      it("should move reports without deps to the beginning", () => {
        const accumulationQueue = createAccumulateQueue();
        const dependencies = [4, 5, 6].map((i) => createWorkReportHash(i));
        const reportsWithDeps = [1, 2, 3].map((i) =>
          createNotAccumulatedWorkReport(createWorkReportHash(i), dependencies),
        );
        const reportsWithoutDeps = [4, 5, 6].map((i) => createNotAccumulatedWorkReport(createWorkReportHash(i)));
        const reports = [...reportsWithDeps, ...reportsWithoutDeps];
        const expectedReports = [...reportsWithoutDeps, ...reportsWithDeps].map((x) => x.report);

        const result = accumulationQueue.enqueueReports(reports);

        deepEqual(result, expectedReports);
      });

      it("should remove reports when deps cannot be met", () => {
        const accumulationQueue = createAccumulateQueue();
        const dependencies = [9].map((i) => createWorkReportHash(i));
        const reportsWithDeps = [1, 2, 3].map((i) =>
          createNotAccumulatedWorkReport(createWorkReportHash(i), dependencies),
        );
        const reportsWithoutDeps = [4, 5, 6].map((i) => createNotAccumulatedWorkReport(createWorkReportHash(i)));
        const reports = [...reportsWithDeps, ...reportsWithoutDeps];
        const expectedReports = [...reportsWithoutDeps].map((x) => x.report);

        const result = accumulationQueue.enqueueReports(reports);

        deepEqual(result, expectedReports);
      });
    });

    describe("getQueueFromState", () => {
      it("should split reports in state by phase index and move the second part to the beginning", () => {
        const queue = Array.from({ length: tinyChainSpec.epochLength }, (_, i) => [
          createNotAccumulatedWorkReport(createWorkReportHash(i)),
        ]);
        const accumulateQueue = createAccumulateQueue(undefined, queue);
        const phaseIndex = 7;
        const slot = tryAsTimeSlot(tinyChainSpec.epochLength + phaseIndex);
        const expectedQueue = [...queue.slice(phaseIndex), ...queue.slice(0, phaseIndex)].flat();

        const result = accumulateQueue.getQueueFromState(slot);

        deepEqual(result, expectedQueue);
      });
    });
  });

  describe("pruneQueue", () => {
    it("should return the same queue when processed hash set is empty", () => {
      const reportsToAccumulate = [
        createNotAccumulatedWorkReport(createWorkReportHash(0)),
        createNotAccumulatedWorkReport(createWorkReportHash(1)),
      ];
      const processedHashes: HashSet<WorkPackageHash> = HashSet.new();

      const result = pruneQueue(reportsToAccumulate, processedHashes);

      deepEqual(result, reportsToAccumulate);
    });

    it("should remove report when processed hash set contains it", () => {
      const workReportHash = createWorkReportHash(0);
      const reportsToAccumulate = [
        createNotAccumulatedWorkReport(workReportHash),
        createNotAccumulatedWorkReport(createWorkReportHash(1)),
      ];
      const processedHashes: HashSet<WorkPackageHash> = HashSet.from([workReportHash]);
      const expectedReportsToAccumulate = reportsToAccumulate.slice(1);

      const result = pruneQueue(reportsToAccumulate, processedHashes);

      deepEqual(result, expectedReportsToAccumulate);
    });

    it("should remove work package hash from dependencies when processed hash set contains it", () => {
      const dependencyHash = createWorkReportHash(0);
      const workReportHash = createWorkReportHash(1);
      const reportsToAccumulate = [
        createNotAccumulatedWorkReport(workReportHash, [dependencyHash]),
        createNotAccumulatedWorkReport(createWorkReportHash(2)),
      ];
      const processedHashes: HashSet<WorkPackageHash> = HashSet.from([dependencyHash]);
      const expectedReportsToAccumulate = [
        createNotAccumulatedWorkReport(workReportHash),
        ...reportsToAccumulate.slice(1),
      ];

      const result = pruneQueue(reportsToAccumulate, processedHashes);

      deepEqual(result, expectedReportsToAccumulate);
    });
  });
});
