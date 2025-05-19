export { add, complete, cycle, suite } from "benny";
import { configure as rawConfigure, save as rawSave } from "benny";
import type { Config } from "benny/lib/internal/common-types.js";

import * as path from "node:path";

export const REL_DIR = `${__dirname}/../..`;
export const DIST_DIR = "dist";
export const BENCHMARKS_DIR = "benchmarks";
export const OUTPUT_DIR = "output";
export const EXPECTED_DIR = "expected";

export function configure(obj: Config) {
  obj.minDisplayPrecision ??= 2;
  return rawConfigure(obj);
}

export function save(benchmarkPath: string) {
  const testPath = path.parse(benchmarkPath);
  const testSuite = path.basename(testPath.dir);
  const defaultParams = {
    file: testPath.name,
    folder: `${REL_DIR}/${BENCHMARKS_DIR}/${testSuite}/${OUTPUT_DIR}`,
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
