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

  let files = initialFiles;
  if (initialFiles.length === 0) {
    // scan the jamtestvectors directory
    files = await scanDir(relPath, directoryToScan, ".json");
  }

  logger.info(`Creating tests for ${files.length} files.`);
  for (const file of files) {
    const absolutePath = path.resolve(`${relPath}/${file}`);
    const data = await fs.readFile(absolutePath, "utf8");
    const testContent = JSON.parse(data);
    const testCase = prepareTest(runners, testContent, file, absolutePath);

    testCase.shouldSkip = accepted !== undefined && !accepted.some((x) => absolutePath.includes(x));

    if (ignoredPatterns.some((x) => absolutePath.includes(x))) {
      logger.log(`Ignoring: ${absolutePath}`);
      continue;
    }

    tests.push(testCase);
  }

  // now we're going to aggregate the tests by their runner.
  const aggregated = new Map<string, TestAndRunner[]>();
  for (const test of tests) {
    const sameRunner = aggregated.get(test.runner) ?? [];
    sameRunner.push(test);
    aggregated.set(test.runner, sameRunner);
  }

  const pathToReplace = new RegExp(`/.*${directoryToScan}/`);

  logger.info(`Running all tests (${tests.length}).`);
  // we have all of the tests now, let's run them in parallel and generate results.
  for (const [key, values] of aggregated.entries()) {
    // split large suites into parts to run them in parallel
    const perPart = 50;
    const parts = Math.ceil(values.length / perPart);
    for (let i = 0; i < parts; i += 1) {
      // we use `setImmediate` here, to make sure to start each suite
      // separately (faster feedback in the console when running tests).
      setImmediate(() => {
        const testName = `${key} tests [${i + 1}/${parts}]`;
        logger.info(`Running ${testName}`);
        test.describe(
          testName,
          {
            concurrency: 100,
            timeout: 60 * 1000,
          },
          () => {
            const partValues = values.slice(i * perPart, (i + 1) * perPart);
            for (const subTest of partValues) {
              const fileName = subTest.file.replace(pathToReplace, "");
              if (subTest.shouldSkip) {
                test.it.skip(fileName, subTest.test);
              } else {
                test.it(fileName, subTest.test);
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
    // the condition is needed to distinguish between tiny and full chain spec
    // without the condition some tests (for example statistics) will be run twice
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
