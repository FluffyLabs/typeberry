import { fromJson, workReportFromJson } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated";

export const notYetAccumulatedFromJson = json.object<NotYetAccumulatedReport>(
  {
    report: workReportFromJson,
    unlocks: json.array(fromJson.bytes32()),
  },
  ({ report, unlocks }) => new NotYetAccumulatedReport(report, unlocks),
);
