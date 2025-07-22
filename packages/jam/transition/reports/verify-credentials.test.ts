import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { Compatibility, GpVersion, asOpaqueType, deepEqual } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import { guaranteesAsView, initialValidators, newCredential, newReports, newWorkReport } from "./test.utils.js";

describe("Reports.verifyCredentials", () => {
  it("should reject insufficient credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(
      tinyChainSpec,
      [
        ReportGuarantee.create({
          slot: tryAsTimeSlot(5),
          report: newWorkReport({ core: 0 }),
          credentials: asOpaqueType([1].map((x) => newCredential(x))),
        }),
      ],
      { disableCredentialsRangeCheck: true },
    );

    const input = { guarantees, slot: tryAsTimeSlot(1), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.InsufficientGuarantees,
      details: "Invalid number of credentials. Expected 2,3, got 1",
    });
  });

  it("should reject too many credentials", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(
      tinyChainSpec,
      [
        ReportGuarantee.create({
          slot: tryAsTimeSlot(5),
          report: newWorkReport({ core: 1 }),
          credentials: asOpaqueType([1, 2, 3, 4].map((x) => newCredential(x))),
        }),
      ],
      { disableCredentialsRangeCheck: true },
    );

    const input = { guarantees, slot: tryAsTimeSlot(1), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

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
      ReportGuarantee.create({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([1, 0].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.NotSortedOrUniqueGuarantors,
      details: "Credentials must be sorted by validator index. Got 0, expected at least 2",
    });
  });

  it("should reject invalid core assignment", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 1 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(6), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.WrongAssignment,
      details: "Invalid core assignment for validator 1. Expected: 0, got: 1",
    });
  });

  it("should reject future reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 1].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(4), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.FutureReportSlot,
      details: "Report slot is in future. Block 4, Report: 5",
    });
  });

  it("should reject old reports", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(9),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.ReportEpochBeforeLast,
      details: "Report slot is too old. Block 25, Report: 9",
    });
  });

  it("should return signatures for verification", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(20),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const input = { guarantees, slot: tryAsTimeSlot(25), knownPackages: [] };
    const hashes = reports.workReportHashes(guarantees);
    const res = reports.verifyCredentials(input, hashes);

    const message = BytesBlob.parseBlob(
      Compatibility.isGreaterOrEqual(GpVersion.V0_6_5)
        ? "0x6a616d5f67756172616e746565d8b3242cac2d1db846434afa3a9eead57339a1244f3203de5e810bfe7ee84de5"
        : "0x6a616d5f67756172616e746565d8c507a9bc5f87033698b255f4fd8b44eda9407def5cf926b5cd36c8f3f4bd52",
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
