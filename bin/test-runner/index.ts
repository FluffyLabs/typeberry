import fs from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { DEFAULT_SUITE, TestSuite } from "@typeberry/utils";
import { Reporter } from "./reporter.js";

const distDir = `${import.meta.dirname}/../../dist`;
try {
  fs.mkdirSync(distDir);
} catch {
  // ignore
}

const suites: { [key: string]: string } = {
  [TestSuite.W3F]: "jamtestvectors",
  [TestSuite.W3F_DAVXY]: "jamtestvectors-davxy",
  [TestSuite.JAMDUNA]: "jamdunavectors",
  [TestSuite.JAVAJAM]: "javajamvectors",
};

const suiteToRun = process.env.TEST_SUITE ?? DEFAULT_SUITE;

const suite = suites[suiteToRun];
if (suite === undefined) {
  throw new Error(`Invalid suite ${suiteToRun}. Available suites: ${Object.keys(suites)}`);
}

const stream = run({
  files: [`${import.meta.dirname}/${suiteToRun}.ts`],
  timeout: 180 * 1000,
  concurrency: true,
}).on("test:fail", () => {
  process.exitCode = 1;
});

stream.compose(new spec()).pipe(process.stdout);

const reporter = new Reporter(suiteToRun);
const fileStream = fs.createWriteStream(`${distDir}/${suite}.txt`);
stream
  .compose(reporter)
  .on("end", () => {
    reporter.finalize(fileStream);
  })
  .pipe(fileStream);
