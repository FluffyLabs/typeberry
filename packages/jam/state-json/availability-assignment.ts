import type { TimeSlot } from "@typeberry/block";
import type { WorkReport } from "@typeberry/block/work-report.js";
import { workReportFromJson } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";
import { AvailabilityAssignment } from "@typeberry/state";

export const availabilityAssignmentFromJson = json.object<JsonAvailabilityAssignment, AvailabilityAssignment>(
  {
    report: workReportFromJson,
    timeout: "number",
  },
  ({ report, timeout }) => {
    return AvailabilityAssignment.create({ workReport: report, timeout });
  },
);

type JsonAvailabilityAssignment = {
  report: WorkReport;
  timeout: TimeSlot;
};
