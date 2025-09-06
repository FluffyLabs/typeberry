import "json-bigint-patch";

import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import util from "node:util";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { Level, Logger } from "@typeberry/logger";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
export const logger = Logger.new(import.meta.filename, "test-runner");

export function runner<T>(
  name: string,
  fromJson: FromJson<T>,
  run: (test: T, path: string) => Promise<void>,
): Runner<unknown> {
  return { name, fromJson, run } as Runner<unknown>;
}

export type Runner<T> = {
  name: string;
  fromJson: FromJson<T>;
  run: (test: T, path: string) => Promise<void>;
};

export async function main(
  runners: Runner<unknown>[],
  initialFiles: string[],
  directoryToScan: string,
  {
    accepted,
    ignored,
  }: {
    accepted?: string[];
    ignored?: string[];
  } = {},
) {
  const relPath = `${import.meta.dirname}/../..`;
  const tests: TestAndRunner[] = [];
  const ignoredPatterns = ignored ?? [];

  let testFiles = initialFiles;
  if (initialFiles.length === 0) {
    // scan the given directory for fallback tests
    testFiles = await scanDir(relPath, directoryToScan, ".json");
  }

  logger.info(`Preparing tests for ${testFiles.length} files.`);
  for (const testFile of testFiles) {
    const absolutePath = path.resolve(`${relPath}/${testFile}`);

    if (ignoredPatterns.some((x) => absolutePath.includes(x))) {
      logger.log(`Ignoring: ${absolutePath}`);
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8");
    const testJson = JSON.parse(content);
    const test = prepareTest(runners, testJson, testFile, absolutePath);

    test.shouldSkip = accepted !== undefined && !accepted.some((x) => absolutePath.includes(x));

    tests.push(test);
  }

  // aggregate the tests by their runner.
  const aggregated = new Map<string, TestAndRunner[]>();
  for (const test of tests) {
    const sameRunner = aggregated.get(test.runner) ?? [];
    sameRunner.push(test);
    aggregated.set(test.runner, sameRunner);
  }

  const pathToReplace = new RegExp(`/.*${directoryToScan}/`);

  logger.info(`Running ${tests.length} tests.`);
  // run in parallel and generate results.
  for (const [testGroupName, testRunners] of aggregated.entries()) {
    // split large suites into parts
    const batchSize = 50;
    const totalBatches = Math.ceil(testRunners.length / batchSize);
    for (let i = 0; i < totalBatches; i += 1) {
      // NOTE: we use `setImmediate` here, to make sure to start each suite
      // separately (faster feedback in the console when running tests).
      setImmediate(() => {
        const testName = `${testGroupName} tests [${i + 1}/${totalBatches}]`;
        logger.info(`Running ${testName}`);
        const timeout = 5 * 60 * 1000;
        test.describe(
          testName,
          {
            concurrency: 100,
            timeout,
          },
          () => {
            const runnersBatch = testRunners.slice(i * batchSize, (i + 1) * batchSize);
            for (const runner of runnersBatch) {
              const fileName = runner.file.replace(pathToReplace, "");
              if (runner.shouldSkip) {
                test.it.skip(fileName, runner.test);
              } else {
                test.it(fileName, { timeout }, runner.test);
              }
            }
          },
        );
      });
    }
  }

  return "Tests registered successfully";
}

async function scanDir(relPath: string, dir: string, filePattern: string): Promise<string[]> {
  const files = await fs.readdir(`${relPath}/${dir}`, {
    recursive: true,
  });
  return files.filter((f) => f.endsWith(filePattern)).map((f) => `${dir}/${f}`);
}

type TestAndRunner = {
  shouldSkip: boolean;
  runner: string;
  file: string;
  test: () => Promise<void>;
};

function prepareTest(runners: Runner<unknown>[], testContent: unknown, file: string, path: string): TestAndRunner {
  const errors: [string, unknown][] = [];
  const handleError = (name: string, e: unknown) => errors.push([name, e]);

  // Find the first runner that is able to parse the input data.
  for (const { name, fromJson, run } of runners) {
    // NOTE: this `if` statement is needed to distinguish between tiny and full chain spec
    // without this `if` some tests (for example statistics) will be run twice
    if (!name.split("/").every((pathPart) => path.includes(pathPart))) {
      continue;
    }

    try {
      const parsedTest = parseFromJson(testContent, fromJson);
      return {
        shouldSkip: false,
        runner: name,
        file,
        test: () => {
          logger.log(`[${name}] running test from ${file}`);
          logger.trace(` ${util.inspect(parsedTest)}`);
          return run(parsedTest, path);
        },
      };
    } catch (e) {
      handleError(name, e);
    }
  }

  return {
    shouldSkip: false,
    runner: "Invalid",
    file,
    test: () => {
      for (const [runner, error] of errors) {
        logger.error(`[${runner}] Parsing error: ${error}`);
      }

      fail(`Unrecognized test case in ${file}`);
    },
  };
}
