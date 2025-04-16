import {WorkReport} from "@typeberry/block/work-report";
import {runCodecTest} from "./common";

export async function runWorkReportTest(test: WorkReport, file: string) {
  runCodecTest(WorkReport.Codec, test, file);
}
