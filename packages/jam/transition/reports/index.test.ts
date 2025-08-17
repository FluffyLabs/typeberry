import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { deepEqual } from "@typeberry/utils";
import type { ReportsInput } from "./reports.js";
import { ENTROPY, guaranteesAsView, newReports } from "./test.utils.js";

describe("Reports - top level", () => {
  it("should perform a transition with empty state", async () => {
    const reports = await newReports();

    const input: ReportsInput = {
      guarantees: guaranteesAsView(tinyChainSpec, []),
      slot: tryAsTimeSlot(12),
      newEntropy: ENTROPY,
      recentBlocksPartialUpdate: reports.state.recentBlocks,
      assurancesAvailAssignment: reports.state.availabilityAssignment,
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
