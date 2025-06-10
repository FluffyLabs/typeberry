import { fromJson, workReportFromJson } from "@typeberry/block-json";
import { json } from "@typeberry/json-parser";
import { NotYetAccumulatedReport } from "@typeberry/state/not-yet-accumulated.js";

export const notYetAccumulatedFromJson = json.object<NotYetAccumulatedReport>(
  {
    report: workReportFromJson,
    dependencies: json.array(fromJson.bytes32()),
  },
  ({ report, dependencies }) => NotYetAccumulatedReport.create({ report, dependencies }),
);
