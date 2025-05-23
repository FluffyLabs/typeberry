import { describe, it } from "node:test";
import { tryAsTimeSlot } from "@typeberry/block";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report";
import { HashDictionary, asKnownSize } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { StateUpdate } from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import type { ReportsInput } from "./reports";
import { guaranteesAsView, newReports } from "./test.utils";

describe("Reports - top level", () => {
  it("should perform a transition with empty state", async () => {
    const reports = await newReports();

    const input: ReportsInput = {
      guarantees: guaranteesAsView(tinyChainSpec, []),
      slot: tryAsTimeSlot(12),
      knownPackages: [],
    };

    const res = await reports.transition(input);

    deepEqual(res, {
      isOk: true,
      isError: false,
      ok: {
        stateUpdate: StateUpdate.new({}),
        reported: HashDictionary.new<WorkPackageHash, WorkPackageInfo>(),
        reporters: asKnownSize([]),
      },
    });
  });
});
