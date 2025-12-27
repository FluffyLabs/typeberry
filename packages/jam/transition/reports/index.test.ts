import { describe, it } from "node:test";
import { tryAsPerValidator, tryAsTimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/refine-context.js";
import { asKnownSize, HashDictionary, HashSet } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import type { Ed25519Key } from "@typeberry/crypto";
import { deepEqual } from "@typeberry/utils";
import type { ReportsInput } from "./input.js";
import { ENTROPY, guaranteesAsView, initialValidators, newReports } from "./test.utils.js";

describe("Reports - top level", () => {
  it("should perform a transition with empty state", async () => {
    const reports = await newReports();

    const input: ReportsInput = {
      guarantees: guaranteesAsView(tinyChainSpec, []),
      slot: tryAsTimeSlot(12),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
      offenders: HashSet.new<Ed25519Key>(),
      currentValidatorData: tryAsPerValidator(initialValidators(), tinyChainSpec),
      previousValidatorData: tryAsPerValidator(initialValidators(), tinyChainSpec),
    };

    const res = await reports.transition(input);

    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: {
        stateUpdate: {
          availabilityAssignment: asKnownSize([null, null]),
        },
        reported: HashDictionary.new<WorkPackageHash, WorkPackageInfo>(),
        reporters: asKnownSize([]),
      },
    });
  });
});
