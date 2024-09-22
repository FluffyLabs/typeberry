import fs from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { Reporter } from "./reporter";

const distDir = `${__dirname}/../../dist`;
try {
  fs.mkdirSync(distDir);
} catch (e) {
  // ignore
}

const stream = run({
  files: [`${__dirname}/cases.ts`],
  timeout: 120 * 1000,
  concurrency: true,
}).on("test:fail", () => {
  process.exitCode = 1;
});

stream.compose(new spec()).pipe(process.stdout);

const reporter = new Reporter();
const fileStream = fs.createWriteStream(`${distDir}/jamtestvectors.txt`);
stream
  .compose(reporter)
  .on("end", () => {
    reporter.finalize(fileStream);
  })
  .pipe(fileStream);
