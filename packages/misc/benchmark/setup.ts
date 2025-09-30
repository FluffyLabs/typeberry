export { add, complete, cycle, suite } from "benny";

import * as path from "node:path";
import { configure as rawConfigure, save as rawSave } from "benny";
import type { Config } from "benny/lib/internal/common-types.js";

export const DIST_DIR = path.resolve(`${import.meta.dirname}/../../../dist`);
export const BENCHMARKS_DIR = path.resolve(`${import.meta.dirname}/../../../benchmarks`);
export const OUTPUT_DIR_NAME = "output";
export const EXPECTED_DIR_NAME = "expected";

export function configure(obj: Config) {
  obj.minDisplayPrecision ??= 2;
  return rawConfigure(obj);
}

export function save(benchmarkPath: string) {
  const testPath = path.parse(benchmarkPath);
  const testSuite = path.basename(testPath.dir);
  const defaultParams = {
    file: testPath.name,
    folder: `${BENCHMARKS_DIR}/${testSuite}/${OUTPUT_DIR_NAME}`,
  };
  return [
    rawSave({
      ...defaultParams,
      details: false,
      format: "json",
    }),
    rawSave({
      ...defaultParams,
      details: true,
      format: "chart.html",
    }),
  ];
}
