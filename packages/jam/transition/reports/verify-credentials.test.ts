import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_SIGNATURE_BYTES, type Ed25519Key } from "@typeberry/crypto";
import { Blake2b } from "@typeberry/hash";
import { asOpaqueType, Compatibility, deepEqual, GpVersion } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import {
  ENTROPY,
  guaranteesAsView,
  initialValidators,
  newCredential,
  newReports,
  newWorkReport,
} from "./test.utils.js";

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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(1),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks, // note: for full fidelity this should be partially updated state, not prior state as it is now
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(1),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(6),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(6),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(4),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(25),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
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

    const input = {
      guarantees,
      slot: tryAsTimeSlot(25),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
    };
    const hashes = reports.workReportHashes(guarantees, await Blake2b.createHasher());
    const res = reports.verifyCredentials(input, hashes);

    const message = BytesBlob.parseBlob(
      Compatibility.isGreaterOrEqual(GpVersion.V0_7_0)
        ? "0x6a616d5f67756172616e7465650f8925aab38c879431d70efa7fa0adc2e1868aa1710aa032041b7c13b194ce36"
        : "0x6a616d5f67756172616e746565d8b3242cac2d1db846434afa3a9eead57339a1244f3203de5e810bfe7ee84de5",
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
