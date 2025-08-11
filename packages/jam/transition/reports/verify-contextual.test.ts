import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees.js";
import { WorkPackageInfo } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import { HashSet } from "@typeberry/collections/hash-set.js";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import { ENTROPY, guaranteesAsView, initialServices, newCredential, newReports, newWorkReport } from "./test.utils.js";

describe("Reports.verifyContextualValidity", () => {
  it("should reject when code hash is not matching", async () => {
    const reports = await newReports({
      services: initialServices({ withDummyCodeHash: true }),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks, // note: for full fidelity this should be partially updated state, not prior state as it is now
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadCodeHash,
      details:
        "Service (129) code hash mismatch. Got: 0x8178abf4f459e8ed591be1f7f629168213a5ac2a487c28c0ef1a806198096c7a, expected: 0x0101010101010101010101010101010101010101010101010101010101010101",
    });
  });

  it("should reject duplicate work packages", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.DuplicatePackage,
      details: "Duplicate work package detected.",
    });
  });

  it("should reject anchor not recent", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          anchorBlock: Bytes.fill(HASH_SIZE, 1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.AnchorNotRecent,
      details:
        "Anchor block 0x0101010101010101010101010101010101010101010101010101010101010101 not found in recent blocks.",
    });
  });

  it("should reject anchor state root not matching", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          stateRoot: Bytes.fill(HASH_SIZE, 1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadStateRoot,
      details:
        "Anchor state root mismatch. Got: 0x0101010101010101010101010101010101010101010101010101010101010101, expected: 0xf6967658df626fa39cbfb6014b50196d23bc2cfbfa71a7591ca7715472dd2b48.",
    });
  });

  it("should reject anchor beefy root not matching", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadBeefyMmrRoot,
      details:
        "Invalid BEEFY super peak hash. Got: 0x9329de635d4bbb8c47cdccbbc1285e48bf9dbad365af44b205343e99dea298f3, expected: 0x0000000000000000000000000000000000000000000000000000000000000000. Anchor: 0xc0564c5e0de0942589df4343ad1956da66797240e2a2f2d6f8116b5047768986",
    });
  });

  it("should reject old lookup anchor", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
          lookupAnchorSlot: tryAsTimeSlot(1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(20_000),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.SegmentRootLookupInvalid,
      details: "Lookup anchor slot's too old. Got: 1, minimal: 5600",
    });
  });

  it("should reject lookup anchor not in chain", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
          lookupAnchor: Bytes.fill(HASH_SIZE, 1),
          lookupAnchorSlot: tryAsTimeSlot(1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.SegmentRootLookupInvalid,
      details:
        "Lookup anchor is not found in chain. Hash: 0x0101010101010101010101010101010101010101010101010101010101010101 (slot: 1)",
    });
  });

  it("should reject duplicate work package that's pending", async () => {
    const reports = await newReports({
      withCoreAssignment: true,
      services: initialServices(),
      clearAvailabilityOnZero: true,
    });

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.DuplicatePackage,
      details:
        "The same work package hash found in the pipeline (workPackageHash: 0x3930000063c03371b9dad9f1c60473ec0326c970984e9c90c0b5ed90eba6ada4)",
    });
  });

  it("should reject duplicate work package from accumulation queue", async () => {
    const reports = await newReports({
      services: initialServices(),
      accumulationQueue: [
        NotYetAccumulatedReport.create({ report: newWorkReport({ core: 1 }), dependencies: asKnownSize([]) }),
      ],
      clearAvailabilityOnZero: true,
    });

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.DuplicatePackage,
      details:
        "The same work package hash found in the pipeline (workPackageHash: 0x3930000063c03371b9dad9f1c60473ec0326c970984e9c90c0b5ed90eba6ada4)",
    });
  });

  it("should reject duplicate work package from recent blocks history", async () => {
    const reports = await newReports({
      services: initialServices(),
      reportedInRecentBlocks: HashDictionary.fromEntries(
        [
          WorkPackageInfo.create({
            workPackageHash: newWorkReport({ core: 0 }).workPackageSpec.hash,
            segmentTreeRoot: Bytes.zero(HASH_SIZE).asOpaque(),
          }),
        ].map((x) => [x.workPackageHash, x]),
      ),
      clearAvailabilityOnZero: true,
    });

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.DuplicatePackage,
      details:
        "The same work package hash found in the pipeline (workPackageHash: 0x3930000063c03371b9dad9f1c60473ec0326c970984e9c90c0b5ed90eba6ada4)",
    });
  });

  it("should reject duplicate work package from recently accumulated work packages", async () => {
    const reports = await newReports({
      services: initialServices(),
      recentlyAccumulated: HashSet.from([newWorkReport({ core: 0 }).workPackageSpec.hash]),
      clearAvailabilityOnZero: true,
    });

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = {
      slot: tryAsTimeSlot(10),
      guarantees,
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
    };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.DuplicatePackage,
      details:
        "The same work package hash found in the pipeline (workPackageHash: 0x3930000063c03371b9dad9f1c60473ec0326c970984e9c90c0b5ed90eba6ada4)",
    });
  });
});
