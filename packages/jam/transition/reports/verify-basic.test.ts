import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees.js";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { asOpaqueType, deepEqual, OK } from "@typeberry/utils";
import { ReportsError } from "./error.js";
import { guaranteesAsView, newCredential, newWorkReport } from "./test.utils.js";
import { MAX_WORK_REPORT_SIZE_BYTES, verifyReportsBasic } from "./verify-basic.js";

describe("Reports.verifyReportsBasic", () => {
  it("should reject if report has too many dependencies", () => {
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({
          core: 0,
          prerequisites: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => Bytes.fill(HASH_SIZE, x)),
        }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const result = verifyReportsBasic(guarantees);

    deepEqual(result, {
      isOk: false,
      isError: true,
      error: ReportsError.TooManyDependencies,
      details: () => "Report at 0 has too many dependencies. Got 9 + 0, max: 8",
    });
  });

  it("should reject if total size is too big", () => {
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0, resultSize: MAX_WORK_REPORT_SIZE_BYTES + 1 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const result = verifyReportsBasic(guarantees);

    deepEqual(result, {
      isOk: false,
      isError: true,
      error: ReportsError.WorkReportTooBig,
      details: () => "Work report at 0 too big. Got 0 + 49153, max: 49152",
    });
  });

  it("should verify correctly", () => {
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.create({
        slot: tryAsTimeSlot(10),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([0, 3].map((x) => newCredential(x))),
      }),
    ]);

    const result = verifyReportsBasic(guarantees);

    deepEqual(result, {
      isOk: true,
      isError: false,
      ok: OK,
    });
  });
});
