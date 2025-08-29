import fs from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { DEFAULT_SUITE, GpVersion, TestSuite } from "@typeberry/utils";
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

let suiteToRun = process.env.TEST_SUITE ?? DEFAULT_SUITE;

const suite = suites[suiteToRun];
if (suite === undefined) {
  throw new Error(`Invalid suite ${suiteToRun}. Available suites: ${Object.keys(suites)}`);
}
if (suiteToRun === TestSuite.JAMDUNA) {
  const versionFromEnv = process.env.GP_VERSION;
  if (versionFromEnv === undefined) {
    throw new Error("GP_VERSION environment variable is required for JAMDUNA suite.");
  }

  const jamdunaVersions: string[] = [GpVersion.V0_6_4, GpVersion.V0_6_5, GpVersion.V0_6_7];
  if (!jamdunaVersions.includes(versionFromEnv)) {
    throw new Error(
      `Invalid GP_VERSION ${versionFromEnv} for JAMDUNA suite. Available versions: ${jamdunaVersions.join(", ")}`,
    );
  }
  const versionWithoutDots = versionFromEnv.replace(/\./g, "");
  suiteToRun = `${suiteToRun}-${versionWithoutDots}`;
}
if (suiteToRun === TestSuite.W3F_DAVXY) {
  const versionFromEnv = process.env.GP_VERSION;
  if (versionFromEnv === undefined) {
    throw new Error("GP_VERSION environment variable is required for DAVXY suite.");
  }

  const davxyVersions: string[] = [GpVersion.V0_6_6, GpVersion.V0_6_7, GpVersion.V0_7_0];
  if (!davxyVersions.includes(versionFromEnv)) {
    throw new Error(
      `Invalid GP_VERSION ${versionFromEnv} for DAVXY suite. Available versions: ${davxyVersions.join(", ")}`,
    );
  }
  const versionWithoutDots = versionFromEnv.replace(/\./g, "");
  suiteToRun = `${suiteToRun}-${versionWithoutDots}`;
}

const stream = run({
  files: [`${import.meta.dirname}/${suiteToRun}.ts`],
  argv: process.argv.slice(2),
  timeout: 10 * 60 * 1000,
  concurrency: true,
}).on("test:fail", () => {
  process.exitCode = 1;
});

stream.compose(new spec()).pipe(process.stdout);

const reporter = new Reporter(suiteToRun);
const fileStream = fs.createWriteStream(`${distDir}/${suiteToRun}.txt`);
stream
  .compose(reporter)
  .on("end", () => {
    reporter.finalize(fileStream);
  })
  .pipe(fileStream);
