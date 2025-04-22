import type { TimeSlot } from "@typeberry/block";
import { workReportFromJson } from "@typeberry/block-json";
import { WorkReport } from "@typeberry/block/work-report";
import { Encoder } from "@typeberry/codec";
import { WithHash, blake2b } from "@typeberry/hash";
import { json } from "@typeberry/json-parser";
import { AvailabilityAssignment } from "@typeberry/state";

export const availabilityAssignmentFromJson = json.object<JsonAvailabilityAssignment, AvailabilityAssignment>(
  {
    report: workReportFromJson,
    timeout: "number",
  },
  ({ report, timeout }) => {
    const workReportHash = blake2b.hashBytes(Encoder.encodeObject(WorkReport.Codec, report)).asOpaque();
    return new AvailabilityAssignment(new WithHash(workReportHash, report), timeout);
  },
);

type JsonAvailabilityAssignment = {
  report: WorkReport;
  timeout: TimeSlot;
};
