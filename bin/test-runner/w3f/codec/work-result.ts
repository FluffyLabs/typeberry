import {WorkResult} from "@typeberry/block/work-result";
import {runCodecTest} from "./common";

export async function runWorkResultTest(test: WorkResult, file: string) {
  runCodecTest(WorkResult.Codec, test, file);
}
