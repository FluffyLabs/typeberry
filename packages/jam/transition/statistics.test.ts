import assert from "node:assert";
import { describe, it } from "node:test";
import {
  type CoreIndex,
  Extrinsic,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { type AssurancesExtrinsic, AvailabilityAssurance } from "@typeberry/block/assurances";
import { I, T, W_G, W_M, W_R, W_X } from "@typeberry/block/gp-constants";
import type { GuaranteesExtrinsic } from "@typeberry/block/guarantees";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import testWorkReport from "@typeberry/block/test-work-report";
import type { TicketsExtrinsic } from "@typeberry/block/tickets";
import { WorkReport } from "@typeberry/block/work-report";
import { BitVec, Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder } from "@typeberry/codec";
import { FixedSizeArray, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ED25519_SIGNATURE_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { isU16, isU32, tryAsU32 } from "@typeberry/numbers";
import {
  CoreStatistics,
  ServiceStatistics,
  StatisticsData,
  ValidatorStatistics,
  copyAndUpdateState,
  tryAsPerCore,
} from "@typeberry/state";
import { asOpaqueType } from "@typeberry/utils";
import { Statistics, type StatisticsState } from "./statistics";

describe("Statistics", () => {
  describe("formulas", () => {
    it("max import score formula should fit into U16", () => {
      assert.strictEqual(isU16(W_M * I), true);
    });

    it("max export score formula should fit into U16", () => {
      assert.strictEqual(isU16(W_X * I), true);
    });

    it("max extrinsic count score formula should fit into U16", () => {
      assert.strictEqual(isU16(T * I), true);
    });

    it("max extrinsic size score formula should fit into U32", () => {
      assert.strictEqual(isU32(W_R * I), true);
    });

    it("max data availability score formula should fit into U32", () => {
      assert.strictEqual(isU32(W_R + W_G * ((W_M * 65) / 64)), true);
    });
  });

  function getExtrinsic(overrides: Partial<Extrinsic> = {}): Extrinsic {
    return Extrinsic.create({
      assurances: overrides.assurances ?? asKnownSize([]),
      guarantees: overrides.guarantees ?? asKnownSize([]),
      disputes: overrides.disputes ?? asKnownSize([]),
      preimages: overrides.preimages ?? asKnownSize([]),
      tickets: overrides.tickets ?? asKnownSize([]),
    });
  }

  const emptyValidatorStatistics = () =>
    tryAsPerValidator(
      Array.from({ length: tinyChainSpec.validatorsCount }, () => {
        return ValidatorStatistics.empty();
      }),
      tinyChainSpec,
    );

  function prepareData({ previousSlot, currentSlot }: { previousSlot: number; currentSlot: number }) {
    const validatorIndex = tryAsValidatorIndex(0);
    const currentStatistics = emptyValidatorStatistics();
    const lastStatistics = emptyValidatorStatistics();
    const coreStatistics = tryAsPerCore(
      FixedSizeArray.fill(() => CoreStatistics.empty(), tinyChainSpec.coresCount),
      tinyChainSpec,
    );
    const serviceStatistics = new Map([[tryAsServiceId(0), ServiceStatistics.empty()]]);
    const statisticsData = StatisticsData.create({
      current: currentStatistics,
      previous: lastStatistics,
      cores: coreStatistics,
      services: serviceStatistics,
    });
    const state: StatisticsState = {
      statistics: statisticsData,
      timeslot: tryAsTimeSlot(previousSlot),
      currentValidatorData: asOpaqueType([]),
    };
    const statistics = new Statistics(tinyChainSpec, state);

    return {
      statistics,
      currentStatistics,
      lastStatistics,
      coreStatistics,
      serviceStatistics,
      state,
      validatorIndex,
      currentSlot: tryAsTimeSlot(currentSlot),
    };
  }

  describe("epoch change", () => {
    it("should keep the same 'current' and 'last' statistics if epoch is not changed", () => {
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex, currentStatistics, lastStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: emptyExtrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });

      const state = copyAndUpdateState(statistics.state, update);

      assert.deepStrictEqual(state.statistics.current, currentStatistics);
      assert.deepStrictEqual(state.statistics.previous, lastStatistics);
    });

    it("should create a new 'current' statistics and previous current should be 'last' when the epoch is changed", () => {
      const previousSlot = 1;
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot,
        currentSlot: previousSlot + tinyChainSpec.epochLength,
      });

      assert.deepStrictEqual(statistics.state.statistics.current, currentStatistics);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: emptyExtrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepStrictEqual(state.statistics.previous, currentStatistics);
    });

    it("should create a new current statistics object that have length equal to number of validators ", () => {
      const previousSlot = 1;
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex } = prepareData({
        previousSlot,
        currentSlot: previousSlot + tinyChainSpec.epochLength,
      });

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: emptyExtrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepStrictEqual(state.statistics.current.length, tinyChainSpec.validatorsCount);
    });
  });

  describe("stats update", () => {
    const createPreimage = (blobLength: number) => ({
      requester: 0,
      blob: { length: blobLength },
    });

    const createAssurance = (validatorIndex: number, bitvec?: BitVec) =>
      AvailabilityAssurance.create({
        anchor: Bytes.zero(HASH_SIZE).asOpaque(),
        bitfield: bitvec ?? BitVec.fromBlob(Bytes.zero(HASH_SIZE).raw, tinyChainSpec.coresCount),
        validatorIndex: tryAsValidatorIndex(validatorIndex),
        signature: Bytes.zero(ED25519_SIGNATURE_BYTES).asOpaque(),
      });

    const countGasUsed = (count: number, gasUsed: bigint) => ({
      count: tryAsU32(count),
      gasUsed: tryAsServiceGas(gasUsed),
    });

    function createWorkReport(coreIndex: CoreIndex): WorkReport {
      const source = BytesBlob.parseBlob(testWorkReport);
      const report = Decoder.decodeObject(WorkReport.Codec, source, tinyChainSpec);
      return WorkReport.create({
        ...report,
        coreIndex: coreIndex,
      });
    }

    function prepareData({ previousSlot, currentSlot }: { previousSlot: number; currentSlot: number }) {
      const validatorIndex = tryAsValidatorIndex(0);
      const serviceIndex = tryAsServiceId(0);
      const currentStatistics = emptyValidatorStatistics();
      const lastStatistics = emptyValidatorStatistics();
      const coreStatistics = tryAsPerCore(
        FixedSizeArray.fill(() => CoreStatistics.empty(), tinyChainSpec.coresCount),
        tinyChainSpec,
      );
      const serviceStatistics = new Map([[serviceIndex, ServiceStatistics.empty()]]);
      const statisticsData = StatisticsData.create({
        current: currentStatistics,
        previous: lastStatistics,
        cores: coreStatistics,
        services: serviceStatistics,
      });
      const state: StatisticsState = {
        statistics: statisticsData,
        timeslot: tryAsTimeSlot(previousSlot),
        currentValidatorData: asOpaqueType([]),
      };
      const statistics = new Statistics(tinyChainSpec, state);

      return {
        statistics,
        currentStatistics,
        lastStatistics,
        coreStatistics,
        serviceStatistics,
        state,
        validatorIndex,
        serviceIndex,
        currentSlot: tryAsTimeSlot(currentSlot),
      };
    }

    it("should increase number of blocks created by validator", () => {
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1 };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].blocks, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: emptyExtrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should add tickets length from extrinstic to tickets in statistics", () => {
      const tickets = [1, 2, 3] as unknown as TicketsExtrinsic;
      const extrinsic = getExtrinsic({ tickets });
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, tickets: tickets.length };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].tickets, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should add preimages length from extrinstic to preImages in statistics", () => {
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const preimages: PreimagesExtrinsic = asKnownSize([createPreimage(0), createPreimage(0), createPreimage(0)]);
      const assurances = asKnownSize([createAssurance(validatorIndex + 1)]) as unknown as AssurancesExtrinsic;
      const extrinsic = getExtrinsic({ preimages, assurances });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, preImages: preimages.length };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].preImages, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should add preimages size length from extrinstic to preImagesSize in statistics", () => {
      const preimages: PreimagesExtrinsic = asKnownSize([createPreimage(1), createPreimage(2), createPreimage(3)]);
      const extrinsic = getExtrinsic({ preimages });
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const expectedStatistics = {
        ...currentStatistics[validatorIndex],
        blocks: 1,
        preImages: preimages.length,
        preImagesSize: 6,
      };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].preImagesSize, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should update guarantees for each validator based on guarantees from extrinstic", () => {
      /**
       * this tests is probably incorrect, see the comment in statistics.ts
       */
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const guarantees = [
        { report: createWorkReport(tryAsCoreIndex(0)), credentials: [{ validatorIndex }] },
      ] as unknown as GuaranteesExtrinsic;
      const extrinsic = getExtrinsic({ guarantees });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, guarantees: 1 };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].guarantees, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should update assurances for each validator based on assurances from extrinstic", () => {
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const assurances = asKnownSize([createAssurance(validatorIndex)]) as unknown as AssurancesExtrinsic;
      const extrinsic = getExtrinsic({ assurances });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, assurances: 1 };

      assert.strictEqual(statistics.state.statistics.current[validatorIndex].assurances, 0);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.current[validatorIndex], expectedStatistics);
    });

    it("should update refine score of core statistics based on incoming work-reports", () => {
      const { statistics, currentSlot, validatorIndex, coreStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const coreIndex = tryAsCoreIndex(0);
      const guarantees = [{ credentials: [{ validatorIndex }] }] as unknown as GuaranteesExtrinsic;
      const extrinsic = getExtrinsic({ guarantees });
      const incomingReports = asKnownSize([createWorkReport(coreIndex)]);
      const expectedStatistics = { ...coreStatistics[coreIndex], bundleSize: 2253240945 };

      assert.deepEqual(statistics.state.statistics.cores[coreIndex], coreStatistics[coreIndex]);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports,
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.cores[coreIndex], expectedStatistics);
    });

    it("should update popularity score of core statistics based on assurances", () => {
      const { statistics, currentSlot, validatorIndex, coreStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const coreIndex = tryAsCoreIndex(0);
      const bitvec = BitVec.fromBlob(BytesBlob.parseBlob("0xff").raw, tinyChainSpec.coresCount);
      const assurances = asKnownSize([createAssurance(validatorIndex, bitvec)]) as unknown as AssurancesExtrinsic;
      const extrinsic = getExtrinsic({ assurances });
      const expectedStatistics = { ...coreStatistics[coreIndex], popularity: 1 };

      assert.deepEqual(statistics.state.statistics.cores[coreIndex], coreStatistics[coreIndex]);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.cores[coreIndex], expectedStatistics);
    });

    it("should update data availability score of core statistics based on available work-reports", () => {
      const { statistics, currentSlot, validatorIndex, coreStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const coreIndex = tryAsCoreIndex(0);
      const guarantees = [{ credentials: [{ validatorIndex }] }] as unknown as GuaranteesExtrinsic;
      const extrinsic = getExtrinsic({ guarantees });
      const availableReports = asKnownSize([createWorkReport(coreIndex)]);
      const expectedStatistics = { ...coreStatistics[coreIndex], dataAvailabilityLoad: 2253257361 };

      assert.deepEqual(statistics.state.statistics.cores[coreIndex], coreStatistics[coreIndex]);

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: asKnownSize([]),
        availableReports,
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.cores[coreIndex], expectedStatistics);
    });

    it("should update provided score of service statistics based on extrinstic preimages", () => {
      const preimages: PreimagesExtrinsic = asKnownSize([createPreimage(1), createPreimage(2), createPreimage(3)]);
      const { statistics, currentSlot, validatorIndex, serviceIndex, serviceStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const guarantees = [
        { report: createWorkReport(tryAsCoreIndex(0)), credentials: [{ validatorIndex }] },
      ] as unknown as GuaranteesExtrinsic;
      const extrinsic = getExtrinsic({ guarantees, preimages });
      const expectedStatistics = {
        ...serviceStatistics.get(serviceIndex),
        providedCount: 3,
        providedSize: 6, // 1 + 2 + 3
      };

      assert.deepEqual(statistics.state.statistics.services.get(serviceIndex), serviceStatistics.get(serviceIndex));

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: extrinsic,
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.services.get(serviceIndex), expectedStatistics);
    });

    it("should update accumulation score of service statistics based on accumulation statistics", () => {
      const { statistics, currentSlot, validatorIndex, serviceIndex, serviceStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });

      const accumulationStatistics = new Map([[tryAsServiceId(0), countGasUsed(1, 3n)]]);

      const expectedStatistics = {
        ...serviceStatistics.get(serviceIndex),
        accumulateCount: 1,
        accumulateGasUsed: 3n,
      };

      assert.deepEqual(statistics.state.statistics.services.get(serviceIndex), serviceStatistics.get(serviceIndex));

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: getExtrinsic(),
        incomingReports: [],
        availableReports: [],
        accumulationStatistics,
        transferStatistics: new Map(),
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.services.get(serviceIndex), expectedStatistics);
    });

    it("should update on transfer score of service statistics based on on transfer statistics", () => {
      const { statistics, currentSlot, validatorIndex, serviceIndex, serviceStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });

      const transferStatistics = new Map([[tryAsServiceId(0), countGasUsed(3, 7n)]]);

      const expectedStatistics = {
        ...serviceStatistics.get(serviceIndex),
        onTransfersCount: 3,
        onTransfersGasUsed: 7n,
      };

      assert.deepEqual(statistics.state.statistics.services.get(serviceIndex), serviceStatistics.get(serviceIndex));

      const update = statistics.transition({
        slot: currentSlot,
        authorIndex: validatorIndex,
        extrinsic: getExtrinsic(),
        incomingReports: [],
        availableReports: [],
        accumulationStatistics: new Map(),
        transferStatistics,
      });
      const state = copyAndUpdateState(statistics.state, update);

      assert.deepEqual(state.statistics.services.get(serviceIndex), expectedStatistics);
    });
  });
});
