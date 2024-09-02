import fs from 'node:fs'
import path from 'node:path';
import chalk from 'chalk';
import {BENCHMARKS_DIR, OUTPUT_DIR, EXPECTED_DIR} from './setup'

runAllBenchmarks()
  .catch(e => console.error(e));

async function runAllBenchmarks() {
  // We are going to run all benchmarks in our benchmark folder.
  const benchmarksPath = `./${BENCHMARKS_DIR}`;
  const benchmarks = fs.readdirSync(benchmarksPath);

  const results = new Map<string, Diff>();
  const promises: Promise<void>[] = [];

  for (const benchmark of benchmarks) {
    const benchPath = `${benchmarksPath}/${benchmark}`;
    if (fs.statSync(benchPath).isDirectory()) {
      const files = fs.readdirSync(benchPath);
      for (const file of files) {
        const isTs = path.extname(file) === '.ts';
        if (isTs) {
          promises.push(
            runBenchmark(benchPath, file)
            .then((res: Diff) => {
              results.set(`${benchmark}/${file}`, res);
            })
          );
        } else {
          console.warn(`Ignoring ${benchPath}/${file}`);
        }
      }
    }
  }

  await Promise.all(promises);

  fs.writeFileSync(`${benchmarksPath}/results.json`, JSON.stringify(Object.fromEntries(results.entries())));
  // print summary
  console.log('Summary:');
  for (const [file, diffs] of results.entries()) {
    for (const [idx, diff] of diffs.entries()) {
      console.log(`${file}[${idx}]: ${'err' in diff ? chalk.red.bold(diff.err) : chalk.green('OK')}`);
    }
  }

  const hasErrors = Array.from(results.entries()).filter(([_key, diff]) => {
    return "err" in diff;
  }).length > 0;

  if (hasErrors) {
    process.exit(-1);
  }
}

async function runBenchmark(benchPath: string, fileName: string): Promise<Diff> {
  const filePath = `${benchPath}/${fileName}`;
  const fileNameNoExt = path.basename(fileName, path.extname(fileName));
  console.log(`Running ${filePath}`);
  const run = require(path.resolve(filePath));
  await run();

  console.log('Compare with expected results.');
  const outputPath = `${benchPath}/${OUTPUT_DIR}/${fileNameNoExt}.json`;
  const expectedPath = `${benchPath}/${EXPECTED_DIR}/${fileNameNoExt}.json`;

  const currentResults = JSON.parse(fs.readFileSync(outputPath).toString());
  const expectedContent = tryReadFile(expectedPath);
  if (expectedContent) {
    const previousResults = JSON.parse(expectedContent.toString());
    return compareResults(currentResults, previousResults);
  }

  // since there are no expected results, let's just copy the existing ones.
  {
    try {
      fs.statSync(path.dirname(expectedPath))
    } catch {
      fs.mkdirSync(path.dirname(expectedPath));
    }
  }
  fs.cpSync(outputPath, expectedPath);
  return compareResults(currentResults, currentResults);
}

function tryReadFile(p: string) {
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

type Diff = {
  err?: string,
  ok?: boolean,
  ops?: [number, number],
  margin?: [number, number],
}[];

type Results = {
  name: string,
  date: string,
  version: string | null,
  results: {
    name: string,
    ops: number,
    margin: number,
    percentSlower: number,
  }[],
  fastest: {
    name: string,
    index: number,
  },
  slowest: {
    name: string,
    index: number,
  }
};

function compareResults(currentResults: Results, previousResults: Results): Diff {
  const curr = currentResults.results;
  const prev = previousResults.results;

  const res: Diff = [];

  for (let i = 0; i < Math.max(curr.length, prev.length); i += 1) {
    if (curr[i].name !== prev[i].name) {
      res.push({
        err: `Mismatching name (current) "${curr[i]?.name}" vs "${prev[i]?.name}" (previous)`,
      });
      continue;
    }

    // compare the difference between results
    const diff = Math.abs(curr[i].ops - prev[i].ops);
    // be generous with the margin
    const margin = 5 + curr[i].margin + prev[i].margin;
    // but take the slower result to comparison.
    const min = Math.min(curr[i].ops, prev[i].ops);
    if (diff > min * margin / 100) {
      res.push({
        err: `Significant speed difference: (current) "${curr[i].ops} ±${curr[i].margin}%" vs "${prev[i].ops} ±${prev[i].margin}%" (previous)`,
        ops: [curr[i].ops, prev[i].ops],
        margin: [curr[i].margin, prev[i].margin],
      });
    } else {
      res.push({
        ok: true,
        ops: [curr[i].ops, prev[i].ops],
        margin: [curr[i].margin, prev[i].margin],
      });
    }
  }

  return res;
}
