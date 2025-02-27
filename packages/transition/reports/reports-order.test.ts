import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import { ReportGuarantee } from "@typeberry/block/guarantees";
import { tinyChainSpec } from "@typeberry/config";
import { asOpaqueType, deepEqual } from "@typeberry/utils";
import { ReportsError } from "./index";
import { verifyReportsOrder } from "./reports-order";
import { guaranteesAsView, newWorkReport } from "./test.utils";

describe("Reports.verifyReportsOrder", () => {
  it("should reject out-of-order guarantees", async () => {
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 1 }),
        credentials: asOpaqueType([]),
      }),
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 0 }),
        credentials: asOpaqueType([]),
      }),
    ]);

    const res = verifyReportsOrder(guarantees, tinyChainSpec);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.OutOfOrderGuarantee,
      details: "Core indices of work reports are not unique or in order. Got: 0, expected: 2",
    });
  });

  it("should reject invalid core index", async () => {
    const guarantees = guaranteesAsView(tinyChainSpec, [
      ReportGuarantee.fromCodec({
        slot: tryAsTimeSlot(5),
        report: newWorkReport({ core: 3 }),
        credentials: asOpaqueType([]),
      }),
    ]);

    const res = verifyReportsOrder(guarantees, tinyChainSpec);

    deepEqual(res, {
      isOk: false,
      isError: true,
      error: ReportsError.BadCoreIndex,
      details: "Invalid core index. Got: 3, max: 2",
    });
  });
});
