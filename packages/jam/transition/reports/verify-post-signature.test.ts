import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees.js";
import { WorkResult } from "@typeberry/block/work-result.js";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { tryAsU64 } from "@typeberry/numbers";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import { guaranteesAsView, initialServices, newCredential, newReports, newWorkReport } from "./test.utils.js";
import { G_A } from "./verify-post-signature.js";

describe("Reports.verifyPostSignatureChecks", () => {
  it("should reject report on core with pending availability", async () => {
    const reports = await newReports({ withCoreAssignment: true });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees, reports.state.availabilityAssignment);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.CoreEngaged,
      details: () => "Report pending availability at core: 0",
    });
  });

  it("should reject report without authorization", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees, reports.state.availabilityAssignment);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.CoreUnauthorized,
      details: () =>
        "Authorizer hash not found in the pool of core 0: 0x022e5e165cc8bd586404257f5cd6f5a31177b5c951eb076c7c10174f90006eef",
    });
  });

  it("should reject report with incorrect service id", async () => {
    const reports = await newReports();
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees, reports.state.availabilityAssignment);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadServiceId,
      details: () => "No service with id: 129",
    });
  });

  it("should reject report with items with too low gas", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees, reports.state.availabilityAssignment);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.ServiceItemGasTooLow,
      details: () => "Service (129) gas is less than minimal. Got: 120, expected at least: 10000",
    });
  });

  it("should reject report with total gas too high", async () => {
    const reports = await newReports({
      services: initialServices(),
    });
    const workReport = newWorkReport({ core: 0, authorizer: Bytes.fill(HASH_SIZE, 1) });
    // override gas to make it too high.
    workReport.results[0] = WorkResult.create({
      ...workReport.results[0],
      gas: asOpaqueType(tryAsU64(G_A + 1)),
    });
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: workReport,
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const res = reports.verifyPostSignatureChecks(guarantees, reports.state.availabilityAssignment);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.WorkReportGasTooHigh,
      details: () => "Total gas too high. Got: 10000001 (ovfl: false), maximal: 10000000",
    });
  });
});
