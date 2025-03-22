import fs from "node:fs";
import path from "node:path";
import { Logger } from "@typeberry/logger";
import chalk from "chalk";
import { formatResults } from "./format";
import { BENCHMARKS_DIR, DIST_DIR, EXPECTED_DIR, OUTPUT_DIR, REL_DIR } from "./setup";
import type { BennyOps, BennyResults, ComparisonResult, ErrorResult, OkResult, Result } from "./types";

const commitHash = process.env.GITHUB_SHA;
const logger = Logger.new(__filename, "benchmarks");

runAllBenchmarks().catch((e: Error) => {
  logger.error(e.message);
  logger.error(`Cause: ${e.cause}`);
  logger.error(`Stack: ${e.stack ?? ""}`);
  process.exit(-1);
});

async function runAllBenchmarks() {
  // We are going to run all benchmarks in our benchmark folder.
  const benchmarksPath = `${REL_DIR}/${BENCHMARKS_DIR}`;
  const distPath = `${REL_DIR}/${DIST_DIR}/${BENCHMARKS_DIR}`;
  fs.mkdirSync(distPath, {
    recursive: true,
  });
  const benchmarks = fs.readdirSync(benchmarksPath);

  const results = new Map<string, Result>();
  const promises: Promise<void>[] = [];

  for (const benchmark of benchmarks) {
    const benchPath = `${benchmarksPath}/${benchmark}`;
    if (fs.statSync(benchPath).isDirectory()) {
      const files = fs.readdirSync(benchPath);
      for (const file of files) {
        const isTs = path.extname(file) === ".ts";
        if (isTs) {
          promises.push(
            runBenchmark(benchPath, file).then((res: Result) => {
              results.set(`${benchmark}/${file}`, res);
            }),
          );
        } else {
          logger.warn(`Ignoring ${benchPath}/${file}`);
        }
      }
    }
  }

  await Promise.all(promises);

  // dump raw JSON
  fs.writeFileSync(`${distPath}/results.json`, JSON.stringify(Object.fromEntries(results.entries()), null, 2));

  // create a textual summary (github comment)
  const txt = formatResults(results, commitHash);
  fs.writeFileSync(`${distPath}/results.txt`, txt);

  // print summary
  logger.log("Summary:");
  for (const [file, diffs] of results.entries()) {
    for (const [idx, diff] of diffs.diff.entries()) {
      logger.log(`${file}[${idx}]: ${"err" in diff ? chalk.red.bold(diff.err) : chalk.green("OK")}`);
    }
  }

  const hasErrors =
    Array.from(results.entries()).filter(([_key, result]) => {
      return result.diff.find((e: OkResult | ErrorResult) => "err" in e) != null;
    }).length > 0;

  if (hasErrors) {
    throw new Error("Errors while running benchmarks. Exiting.");
  }
}

async function runBenchmark(benchPath: string, fileName: string): Promise<Result> {
  const filePath = `${benchPath}/${fileName}`;
  const fileNameNoExt = path.basename(fileName, path.extname(fileName));
  logger.log(`Running ${filePath}`);
  const run = require(path.resolve(filePath));
  await run();

  logger.log("Compare with expected results.");
  const outputPath = `${benchPath}/${OUTPUT_DIR}/${fileNameNoExt}.json`;
  const expectedPath = `${benchPath}/${EXPECTED_DIR}/${fileNameNoExt}.json`;

  const currentResults = JSON.parse(fs.readFileSync(outputPath).toString());
  const expectedContent = tryReadFile(expectedPath);
  if (expectedContent != null) {
    const previousResults = JSON.parse(expectedContent.toString());
    return {
      diff: compareResults(currentResults, previousResults),
      current: currentResults,
    };
  }

  // If the expected directory does not exist, just compare with itself.
  return {
    diff: compareResults(currentResults, currentResults),
    current: currentResults,
  };
}

function tryReadFile(p: string) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function compareResults(currentResults: BennyResults, expectedResults: BennyResults): ComparisonResult {
  const curr = currentResults.results;
  let prev = expectedResults.results;

  // should not happen, since BennyResults always have some results.
  if (curr === null) {
    return [];
  }

  // if there is no expectation on the results, just check which case is the fastest.
  prev = prev ?? curr;

  const res: ComparisonResult = [];

  const currMinOps = Math.min(...Array.from(curr.values()).map((x) => x.ops));
  const prevMinOps = Math.min(...Array.from(prev.values()).map((x) => x.ops));

  for (let i = 0; i < Math.max(curr.length, prev.length); i += 1) {
    if (curr[i]?.name !== prev[i]?.name) {
      res.push({
        name: curr[i]?.name ?? prev[i]?.name,
        err: `Mismatching name (current) "${curr[i]?.name}" vs "${prev[i]?.name}" (expected)`,
      });
      continue;
    }

    // we work on normalized results
    const currNormalized = Math.sqrt(curr[i].ops / currMinOps);
    const prevNormalized = Math.sqrt(prev[i].ops / prevMinOps);

    // compare the difference between results
    const diff = Math.abs(currNormalized - prevNormalized);
    // be generous with the margin
    const margin = 5 + curr[i].margin + prev[i].margin;
    // but take the slower result to comparison.
    const min = Math.min(currNormalized, prevNormalized);
    if (diff > (min * margin) / 100) {
      res.push({
        name: curr[i].name,
        err: errMsg(curr[i], prev[i], currNormalized, prevNormalized),
        ops: [curr[i].ops, prev[i].ops],
        margin: [curr[i].margin, prev[i].margin],
      });
    } else {
      res.push({
        name: curr[i].name,
        ok: true,
        ops: [curr[i].ops, prev[i].ops],
        margin: [curr[i].margin, prev[i].margin],
      });
    }
  }

  return [...res, ...compareFastest(currentResults, expectedResults)];
}

function compareFastest(currentResults: BennyResults, expectedResults: BennyResults): ComparisonResult {
  const current = Array.isArray(currentResults.fastest) ? currentResults.fastest[0] : currentResults.fastest;
  const expected = Array.isArray(expectedResults.fastest) ? expectedResults.fastest : [expectedResults.fastest];

  const expectedNames: string[] = [];
  for (const e of expected) {
    if (current.name === e.name && current.index === e.index) {
      return [];
    }
    expectedNames.push(`${e.name}[${e.index}]`);
  }

  return [
    {
      name: current.name,
      err: `Fastest result changed to (current) "${current.name}[${current.index}]" from "${expectedNames.join(" or ")}" (expected) ❌`,
    },
  ];
}

function errMsg(curr: BennyOps, prev: BennyOps, currNormalized: number, prevNormalized: number) {
  return `Significant speed difference: (current) "${curr.ops} (${currNormalized}) ±${curr.margin}%" vs "${prev.ops} (${prevNormalized}) ± ${prev.margin}%" (previous)`;
}
