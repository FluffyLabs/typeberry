import assert from "node:assert";
import { describe, test } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { Bytes } from "@typeberry/bytes";
import { tinyChainSpec } from "@typeberry/config";
import { HASH_SIZE } from "@typeberry/hash";
import { type AvailabilityAssignment, tryAsPerCore } from "@typeberry/state";
import { mergeAvailabilityAssignments } from "./chain-stf.js";

describe("mergeAvailabilityAssignments", () => {
  function prepareAssignment(hashSeed: number): AvailabilityAssignment {
    return {
      timeout: tryAsTimeSlot(0),
      workReport: {
        data: {} as unknown as WorkReport, // the data does not matter in this test
        hash: Bytes.fill(HASH_SIZE, hashSeed).asOpaque(),
      },
    };
  }

  test("disputes should be able to clear the assigment", () => {
    const firstCoreAssignment = prepareAssignment(0);
    const secondCoreAssignment = prepareAssignment(1);
    const initialAssignment = tryAsPerCore([firstCoreAssignment, secondCoreAssignment], tinyChainSpec);
    const disputesAssignment = tryAsPerCore([null, secondCoreAssignment], tinyChainSpec);
    const assurancesAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const reportsAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const expectedAssignment = disputesAssignment.slice();

    const result = mergeAvailabilityAssignments(
      initialAssignment,
      reportsAssignment,
      disputesAssignment,
      assurancesAssignment,
    );

    assert.deepStrictEqual(result, expectedAssignment);
  });

  test("assurances should be able to clear the assigment", () => {
    const firstCoreAssignment = prepareAssignment(0);
    const secondCoreAssignment = prepareAssignment(1);
    const initialAssignment = tryAsPerCore([firstCoreAssignment, secondCoreAssignment], tinyChainSpec);
    const disputesAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const assurancesAssignment = tryAsPerCore([null, secondCoreAssignment], tinyChainSpec);
    const reportsAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const expectedAssignment = assurancesAssignment.slice();

    const result = mergeAvailabilityAssignments(
      initialAssignment,
      reportsAssignment,
      disputesAssignment,
      assurancesAssignment,
    );

    assert.deepStrictEqual(result, expectedAssignment);
  });

  test("reports should be able to assign a new report to an empty core", () => {
    const firstCoreAssignment = prepareAssignment(0);
    const secondCoreAssignment = prepareAssignment(1);
    const initialAssignment = tryAsPerCore([null, null], tinyChainSpec);
    const disputesAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const assurancesAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const reportsAssignment = tryAsPerCore([firstCoreAssignment, secondCoreAssignment], tinyChainSpec);
    const expectedAssignment = reportsAssignment.slice();

    const result = mergeAvailabilityAssignments(
      initialAssignment,
      reportsAssignment,
      disputesAssignment,
      assurancesAssignment,
    );

    assert.deepStrictEqual(result, expectedAssignment);
  });

  test("reports should be able to assign a new report a core that was cleared", () => {
    const firstCoreAssignment = prepareAssignment(0);
    const secondCoreAssignment = prepareAssignment(1);
    const initialAssignment = tryAsPerCore([firstCoreAssignment, null], tinyChainSpec);
    const disputesAssignment = tryAsPerCore([null, null], tinyChainSpec);
    const assurancesAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const reportsAssignment = tryAsPerCore([secondCoreAssignment, null], tinyChainSpec);
    const expectedAssignment = reportsAssignment.slice();

    const result = mergeAvailabilityAssignments(
      initialAssignment,
      reportsAssignment,
      disputesAssignment,
      assurancesAssignment,
    );

    assert.deepStrictEqual(result, expectedAssignment);
  });

  test("reports should not restore the assignemnt cleared by disputes and assurances", () => {
    const firstCoreAssignment = prepareAssignment(0);
    const secondCoreAssignment = prepareAssignment(1);
    const initialAssignment = tryAsPerCore([firstCoreAssignment, secondCoreAssignment], tinyChainSpec);
    const disputesAssignment = tryAsPerCore([null, secondCoreAssignment], tinyChainSpec);
    const assurancesAssignment = tryAsPerCore([firstCoreAssignment, null], tinyChainSpec);
    const reportsAssignment = tryAsPerCore(initialAssignment.slice(), tinyChainSpec);
    const expectedAssignment = tryAsPerCore([null, null], tinyChainSpec);

    const result = mergeAvailabilityAssignments(
      initialAssignment,
      reportsAssignment,
      disputesAssignment,
      assurancesAssignment,
    );

    assert.deepStrictEqual(result, expectedAssignment);
  });
});
