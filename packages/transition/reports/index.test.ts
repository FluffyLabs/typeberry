import { describe, it } from "node:test";
import {
  ED25519_SIGNATURE_BYTES,
  type Ed25519Signature,
  tryAsServiceId,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { G_A } from "@typeberry/block/gp-constants";
import { Credential, ReportGuarantee } from "@typeberry/block/guarantees";
import { WorkPackageInfo } from "@typeberry/block/work-report";
import { WorkResult } from "@typeberry/block/work-result";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU32, tryAsU64 } from "@typeberry/numbers";
import { tryAsGas } from "@typeberry/pvm-interpreter";
import { Service, ServiceAccountInfo } from "@typeberry/state";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { ReportsError } from "./error";
import type { ReportsInput } from "./reports";
import { guaranteesAsView, initialValidators, newReports, newWorkReport } from "./test.utils";

describe("Reports - top level", () => {
  it("should perform a transition with empty state", async () => {
    const reports = await newReports();

    const input: ReportsInput = {
      guarantees: guaranteesAsView(tinyChainSpec, []),
      slot: tryAsTimeSlot(12),
    };

    const res = await reports.transition(input);

    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: {
        reported: [],
        reporters: asKnownSize([]),
      },
    });
  });
});

describe("Reports.verifyCredentials", () => {
  it("should reject insufficient credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(1) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.InsufficientGuarantees,
      details: "Invalid number of credentials. Expected 2,3, got 1",
    });
  });

  it("should reject too many credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([1, 2, 3, 4].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(1) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.InsufficientGuarantees,
      details: "Invalid number of credentials. Expected 2,3, got 4",
    });
  });

  it("should reject out-of-order credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 1 }),
        credentials: asOpaqueType([1, 0].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.NotSortedOrUniqueGuarantors,
      details: "Credentials must be sorted by validator index. Got 0, expected 2",
    });
  });

  it("should reject invalid core assignment", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.WrongAssignment,
      details: "Invalid core assignment for validator 1. Expected: 1, got: 0",
    });
  });

  it("should reject future reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(4) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.FutureReportSlot,
      details: "Report slot is in future or too old. Block 4, Report: 5",
    });
  });

  it("should reject old reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(9),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25) };
    const res = reports.verifyCredentials(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.ReportEpochBeforeLast,
      details: "Report slot is in future or too old. Block 25, Report: 9",
    });
  });

  it("should return signatures for verification", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25) };
    const res = reports.verifyCredentials(input);

    const message = BytesBlob.parseBlob(
      "0x6a616d5f67756172616e74656523d9dc0dcb965edddacb4522b56b5f22bf7db53f462f194070254dde92ccfd43",
    );

    const validators = initialValidators();
    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: [
        {
          signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
          key: validators[0].ed25519,
          message,
        },
        {
          signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
          key: validators[3].ed25519,
          message,
        },
      ],
    });
  });
});

describe("Reports.verifyPostSignatureChecks", () => {
  it("should reject report on core with pending availability", async () => {
    const reports = await newReports({ withCoreAssignment: true });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.CoreEngaged,
      details: "Report pending availability at core: 0",
    });
  });

  it("should reject report without authorization", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.CoreUnauthorized,
      details:
        "Authorizer hash not found in the pool of core 0: 0x022e5e165cc8bd586404257f5cd6f5a31177b5c951eb076c7c10174f90006eef",
    });
  });

  it("should reject report with incorrect service id", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadServiceId,
      details: "No service with id: 129",
    });
  });

  it("should reject report with items with too low gas", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.ServiceItemGasTooLow,
      details: "Service (129) gas is less than minimal. Got: 120, expected at least: 10000",
    });
  });

  it("should reject report with total gas too high", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const workReport = newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) });
    // override gas to make it too high.
    workReport.results[0] = WorkResult.fromCodec({
      ...workReport.results[0],
      gas: asOpaqueType(tryAsU64(G_A + 1)),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: workReport,
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.WorkReportGasTooHigh,
      details: "Total gas too high. Got: 10000001 (ovfl: false), maximal: 10000000",
    });
  });
});

describe("Reports.verifyContextualValidity", () => {
  it("should reject when code hash is not matching", async () => {
    const reports = await newReports({
      services: initialServices({ withDummyCodeHash: true }),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          anchorBlock: Bytes.fill(HASH_SIZE, 1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          stateRoot: Bytes.fill(HASH_SIZE, 1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
    const res = reports.verifyContextualValidity(input);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadBeefyMmrRoot,
      details:
        "Invalid BEEFY super peak hash. Got: 0x9329de635d4bbb8c47cdccbbc1285e48bf9dbad365af44b205343e99dea298f3, expected: 0x0000000000000000000000000000000000000000000000000000000000000000",
    });
  });

  it("should reject old lookup anchor", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
          lookupAnchorSlot: tryAsTimeSlot(1),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(20_000), guarantees };
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
      ReportGuarantee.fromCodec({
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
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
    });
    reports.state.availabilityAssignment[0] = null;

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      accumulationQueue: [new NotYetAccumulatedReport(newWorkReport({ core: 1 }), [])],
    });
    reports.state.availabilityAssignment[0] = null;

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      reportedInRecentBlocks: [
        new WorkPackageInfo(newWorkReport({ core: 0 }).workPackageSpec.hash, Bytes.zero(HASH_SIZE).asOpaque()),
      ],
    });
    reports.state.availabilityAssignment[0] = null;

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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
      recentlyAccumulated: [newWorkReport({ core: 0 }).workPackageSpec.hash],
    });
    reports.state.availabilityAssignment[0] = null;

    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          beefyRoot: Bytes.zero(HASH_SIZE),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);
    const input = { slot: tryAsTimeSlot(10), guarantees };
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

function newCredential(index: number, signature?: Ed25519Signature) {
  return Credential.fromCodec({
    validatorIndex: tryAsValidatorIndex(index),
    signature: signature ?? Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
  });
}

const initialServices = ({ withDummyCodeHash = false } = {}): Service[] => [
  new Service(tryAsServiceId(129), {
    preimages: [],
    service: ServiceAccountInfo.fromCodec({
      codeHash: withDummyCodeHash
        ? Bytes.fill(HASH_SIZE, 1).asOpaque()
        : Bytes.parseBytes("0x8178abf4f459e8ed591be1f7f629168213a5ac2a487c28c0ef1a806198096c7a", HASH_SIZE).asOpaque(),
      balance: tryAsU64(0),
      thresholdBalance: tryAsU64(0),
      accumulateMinGas: tryAsGas(10_000),
      onTransferMinGas: tryAsGas(0),
      storageUtilisationBytes: tryAsU64(1),
      storageUtilisationCount: tryAsU32(1),
    }),
  }),
];
