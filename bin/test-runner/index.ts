import fs from "node:fs";
import { run } from "node:test";
import { spec } from "node:test/reporters";
import { Reporter } from "./reporter";

const distDir = `${__dirname}/../../dist`;
fs.mkdirSync(distDir);

const stream = run({
  files: [`${__dirname}/cases.ts`],
  timeout: 120 * 1000,
  concurrency: true,
}).on("test:fail", () => {
  process.exitCode = 1;
});

stream.compose(new spec()).pipe(process.stdout);

stream.compose(new Reporter()).pipe(fs.createWriteStream(`${distDir}/jamtestvectors.txt`));
