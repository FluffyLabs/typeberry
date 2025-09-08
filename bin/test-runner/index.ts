import fs from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { Reporter } from "./reporter.js";

const distDir = `${import.meta.dirname}/../../dist`;
try {
  fs.mkdirSync(distDir);
} catch {
  // ignore
}

const suiteToRun = process.argv[1];
if (suiteToRun === undefined) {
  throw new Error("Provide 1 argument with a suite filename to run.");
}

const stream = run({
  files: [`${import.meta.dirname}/${suiteToRun}`],
  argv: process.argv.slice(2),
  timeout: 10 * 60 * 1000,
  concurrency: true,
}).on("test:fail", () => {
  process.exitCode = 1;
});

stream.compose(new spec()).pipe(process.stdout);

const reporter = new Reporter(suiteToRun);
const fileStream = fs.createWriteStream(`${distDir}/${suiteToRun.replace('.ts', '')}.txt`);
stream
  .compose(reporter)
  .on("end", () => {
    reporter.finalize(fileStream);
  })
  .pipe(fileStream);
