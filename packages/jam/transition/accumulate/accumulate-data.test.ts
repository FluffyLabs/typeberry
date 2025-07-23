import { describe, it } from "node:test";
import { tryAsServiceGas, tryAsServiceId } from "@typeberry/block";
import { testWorkReportHex } from "@typeberry/block/test-helpers.js";
import { WorkReport } from "@typeberry/block/work-report.js";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { tinyChainSpec } from "@typeberry/config";
import { AutoAccumulate } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { AccumulateData } from "./accumulate-data.js";
import { Operand } from "./operand.js";

const getWorkReport = () => {
  const hex = testWorkReportHex();
  return Decoder.decodeObject(WorkReport.Codec, BytesBlob.parseBlob(hex), tinyChainSpec);
};

const createAutoAccumulate = (serviceId: number, gasCost = 0n) => {
  return AutoAccumulate.create({ service: tryAsServiceId(serviceId), gasLimit: tryAsServiceGas(gasCost) });
};

const transformReportToOperands = (report: WorkReport) => {
  const operands: Operand[] = [];

  for (const result of report.results) {
    operands.push(
      Operand.new({
        gas: result.gas, // g
        payloadHash: result.payloadHash, // y
        result: result.result, // d
        authorizationOutput: report.authorizationOutput, // o
        exportsRoot: report.workPackageSpec.exportsRoot, // e
        hash: report.workPackageSpec.hash, // h
        authorizerHash: report.authorizerHash, // a
      }),
    );
  }

  return operands;
};
describe("AccumulateData", () => {
  describe("getOperands", () => {
    it("should return correct operands for a report", () => {
      const serviceId = tryAsServiceId(129);
      const report = getWorkReport();
      const reports = [report];
      const acumulateData = new AccumulateData(reports, []);
      const expectedOperands = transformReportToOperands(report);

      const result = acumulateData.getOperands(serviceId);

      deepEqual(result, expectedOperands);
    });
  });

  describe("getReportsLength", () => {
    it("should return correct reports length for a report", () => {
      const serviceId = tryAsServiceId(129);
      const report = getWorkReport();
      const reports = [report];
      const acumulateData = new AccumulateData(reports, []);
      const expectedLength = report.results.length;

      const result = acumulateData.getReportsLength(serviceId);

      deepEqual(result, expectedLength);
    });
  });

  describe("getGasCost", () => {
    it("should return correct gas cost for a report", () => {
      const serviceId = tryAsServiceId(129);
      const report = getWorkReport();
      const reports = [report];
      const acumulateData = new AccumulateData(reports, []);
      const expectedGasCost = report.results.reduce((acc, result) => acc + result.gas, 0n);

      const result = acumulateData.getGasCost(serviceId);

      deepEqual(result, expectedGasCost);
    });

    it("should return correct gas cost for a report and auto accumulate service", () => {
      const serviceId = tryAsServiceId(129);
      const report = getWorkReport();
      const autoAccumulateGas = 100n;
      const autoAccumulateServices = [createAutoAccumulate(129, autoAccumulateGas)];

      const reports = [report];
      const acumulateData = new AccumulateData(reports, autoAccumulateServices);
      const expectedGasCost = report.results.reduce((acc, result) => acc + result.gas, 0n) + autoAccumulateGas;

      const result = acumulateData.getGasCost(serviceId);

      deepEqual(result, expectedGasCost);
    });
  });

  describe("getServiceIds", () => {
    it("should return empty array when no reports and auto accumulate services", () => {
      const acumulateData = new AccumulateData([], []);

      const result = acumulateData.getServiceIds();

      deepEqual(result, []);
    });

    it("should return unique service ids from reports", () => {
      const reports = [getWorkReport(), getWorkReport()];
      const expectedServiceIds = [129].map(tryAsServiceId);
      const acumulateData = new AccumulateData(reports, []);

      const result = acumulateData.getServiceIds();

      deepEqual(result, expectedServiceIds);
    });

    it("should return unique service ids from auto accumulate services", () => {
      const autoAccumulateServices = [createAutoAccumulate(129), createAutoAccumulate(129)];
      const expectedServiceIds = [129].map(tryAsServiceId);
      const acumulateData = new AccumulateData([], autoAccumulateServices);

      const result = acumulateData.getServiceIds();

      deepEqual(result, expectedServiceIds);
    });

    it("should return unique service ids from reports and auto accumulate services", () => {
      const reports = [getWorkReport()];
      const autoAccumulateServices = [createAutoAccumulate(129)];
      const expectedServiceIds = [129].map(tryAsServiceId);
      const acumulateData = new AccumulateData(reports, autoAccumulateServices);

      const result = acumulateData.getServiceIds();

      deepEqual(result, expectedServiceIds);
    });
  });
});
