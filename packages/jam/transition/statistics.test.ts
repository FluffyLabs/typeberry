import assert from "node:assert";
import { describe, it } from "node:test";
import { Extrinsic, tryAsPerValidator, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import type { AssurancesExtrinsic } from "@typeberry/block/assurances";
import type { GuaranteesExtrinsic } from "@typeberry/block/guarantees";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { TicketsExtrinsic } from "@typeberry/block/tickets";
import { asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { ActivityData, ActivityRecord } from "@typeberry/state";
import { asOpaqueType } from "@typeberry/utils";
import { Statistics, type StatisticsState } from "./statistics";

describe("Statistics", () => {
  function getExtrinsic(overrides: Partial<Extrinsic> = {}): Extrinsic {
    return Extrinsic.fromCodec({
      assurances: overrides.assurances ?? asKnownSize([]),
      guarantees: overrides.guarantees ?? asKnownSize([]),
      disputes: overrides.disputes ?? asKnownSize([]),
      preimages: overrides.preimages ?? asKnownSize([]),
      tickets: overrides.tickets ?? asKnownSize([]),
    });
  }

  const emptyStatistics = () =>
    tryAsPerValidator(
      [
        ActivityRecord.empty(),
        ActivityRecord.empty(),
        ActivityRecord.empty(),
        ActivityRecord.empty(),
        ActivityRecord.empty(),
        ActivityRecord.empty(),
      ],
      tinyChainSpec,
    );

  function prepareData({ previousSlot, currentSlot }: { previousSlot: number; currentSlot: number }) {
    const validatorIndex = tryAsValidatorIndex(0);
    const currentStatistics = emptyStatistics();
    const lastStatistics = emptyStatistics();
    const statisticsPerValidator = new ActivityData({ current: currentStatistics, previous: lastStatistics });
    const state: StatisticsState = {
      statisticsPerValidator,
      timeslot: tryAsTimeSlot(previousSlot),
      currentValidatorData: asOpaqueType([]),
    };
    const statistics = new Statistics(tinyChainSpec, state);

    return {
      statistics,
      currentStatistics,
      lastStatistics,
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

      statistics.transition(currentSlot, validatorIndex, emptyExtrinsic);

      assert.strictEqual(statistics.state.statisticsPerValidator.current, currentStatistics);
      assert.strictEqual(statistics.state.statisticsPerValidator.previous, lastStatistics);
      assert.deepStrictEqual(statistics.state.statisticsPerValidator.previous, lastStatistics);
    });

    it("should create a new 'current' statistics and previous current should be 'last' when the epoch is changed", () => {
      const previousSlot = 1;
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot,
        currentSlot: previousSlot + tinyChainSpec.epochLength,
      });

      statistics.transition(currentSlot, validatorIndex, emptyExtrinsic);

      assert.strictEqual(statistics.state.statisticsPerValidator.previous, currentStatistics);
      assert.deepStrictEqual(statistics.state.statisticsPerValidator.previous, currentStatistics);
    });

    it("should create a new current statistics object that have length equal to number of validators ", () => {
      const previousSlot = 1;
      const emptyExtrinsic = getExtrinsic();
      const { statistics, currentSlot, validatorIndex } = prepareData({
        previousSlot,
        currentSlot: previousSlot + tinyChainSpec.epochLength,
      });

      statistics.transition(currentSlot, validatorIndex, emptyExtrinsic);

      assert.deepStrictEqual(statistics.state.statisticsPerValidator.current.length, tinyChainSpec.validatorsCount);
    });
  });

  describe("stats update", () => {
    const createPreimage = (blobLength: number) => ({ blob: { length: blobLength } });

    function prepareData({ previousSlot, currentSlot }: { previousSlot: number; currentSlot: number }) {
      const validatorIndex = tryAsValidatorIndex(0);
      const currentStatistics = emptyStatistics();
      const lastStatistics = emptyStatistics();
      const statisticsPerValidator = new ActivityData({ current: currentStatistics, previous: lastStatistics });
      const state: StatisticsState = {
        statisticsPerValidator,
        timeslot: tryAsTimeSlot(previousSlot),
        currentValidatorData: asOpaqueType([]),
      };
      const statistics = new Statistics(tinyChainSpec, state);

      return {
        statistics,
        currentStatistics,
        lastStatistics,
        state,
        validatorIndex,
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

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].blocks, 0);

      statistics.transition(currentSlot, validatorIndex, emptyExtrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
    });

    it("should add tickets length from extrinstic to tickets in statistics", () => {
      const tickets = [1, 2, 3] as unknown as TicketsExtrinsic;
      const extrinsic = getExtrinsic({ tickets });
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, tickets: tickets.length };

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].tickets, 0);

      statistics.transition(currentSlot, validatorIndex, extrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
    });

    it("should add preimages length from extrinstic to preImages in statistics", () => {
      const preimages: PreimagesExtrinsic = asKnownSize([createPreimage(0), createPreimage(0), createPreimage(0)]);
      const extrinsic = getExtrinsic({ preimages });
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, preImages: preimages.length };

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].preImages, 0);

      statistics.transition(currentSlot, validatorIndex, extrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
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

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].preImagesSize, 0);

      statistics.transition(currentSlot, validatorIndex, extrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
    });

    it("should update guarantees for each validator based on guarantees from extrinstic", () => {
      /**
       * this tests is probably incorrect, see the comment in statistics.ts
       */
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const guarantees = [{ credentials: [{ validatorIndex }] }] as unknown as GuaranteesExtrinsic;
      const extrinsic = getExtrinsic({ guarantees });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, guarantees: 1 };

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].guarantees, 0);

      statistics.transition(currentSlot, validatorIndex, extrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
    });

    it("should update assurances for each validator based on assurances from extrinstic", () => {
      const { statistics, currentSlot, validatorIndex, currentStatistics } = prepareData({
        previousSlot: 0,
        currentSlot: 1,
      });
      const assurances = [{ validatorIndex }] as unknown as AssurancesExtrinsic;
      const extrinsic = getExtrinsic({ assurances });
      const expectedStatistics = { ...currentStatistics[validatorIndex], blocks: 1, assurances: 1 };

      assert.strictEqual(statistics.state.statisticsPerValidator.current[validatorIndex].assurances, 0);

      statistics.transition(currentSlot, validatorIndex, extrinsic);

      assert.deepEqual(statistics.state.statisticsPerValidator.current[validatorIndex], expectedStatistics);
    });
  });
});
