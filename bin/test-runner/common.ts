import "json-bigint-patch";

import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import util from "node:util";
import { type Decode, Decoder } from "@typeberry/codec";
import { tinyChainSpec, type ChainSpec } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { Level, Logger } from "@typeberry/logger";
import {check} from "@typeberry/utils";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
export const logger = Logger.new(import.meta.filename, "test-runner");

export function runner<T, V = never>(
  path: string,
  parser: testFile.Kind<T>,
  run: RunFunction<T, V>,
  {
    chainSpecs = [tinyChainSpec],
    variants = [],
  }: {
    chainSpecs: ChainSpec[],
    variants: V[],
  }
): Runner<unknown, unknown> {
  check`${chainSpecs.length > 0} At least one chainspec missing in ${path} runner.`;
  return { path, parser, run, variants, chainSpecs } as Runner<unknown, unknown>;
}

export type RunOptions = {
  test: TestContext;
  chainSpec: ChainSpec;
  path: string;
};

export type RunFunction<T, V> = (
  test: T,
  variant: V,
  options: RunOptions,
) => Promise<void>;

export type Runner<T, V> = {
  path: string;
  parser: testFile.Kind<T>;
  run: RunFunction<T, V>;
  variants: V[];
  chainSpecs: ChainSpec[];
};

export namespace testFile {
  export const JSON = '.json';
  export type JSON = typeof JSON;
  export const BIN = '.bin';
  export type BIN = typeof BIN;

  export type Kind<T> = {
    kind: JSON;
    fromJson: FromJson<T>;
  } | {
    kind: BIN;
    codec: Decode<T>;
  };

  export type Content =
    | {
      kind: JSON;
      content: string;
    }
    | {
      kind: BIN;
      content: Uint8Array;
    };


  export function json<T>(fromJson: FromJson<T>): Kind<T> {
    return { kind: JSON, fromJson };
  }

  export function bin<T>(codec: Decode<T>): Kind<T> {
    return { kind: BIN, codec: codec };
  }
}

export async function main(
  runners: Runner<unknown, unknown>[],
  initialFiles: string[],
  directoryToScan: string,
  {
    pattern = testFile.JSON,
    accepted,
    ignored,
  }: {
    pattern?: testFile.JSON | testFile.BIN;
    accepted?: string[];
    ignored?: string[];
  } = {},
) {
  await initWasm();
  const relPath = `${import.meta.dirname}/../..`;
  const tests: TestAndRunner<unknown>[] = [];
  const ignoredPatterns = ignored ?? [];

  let testFiles = initialFiles;
  if (initialFiles.length === 0) {
    // scan the given directory for fallback tests
    testFiles = await scanDir(relPath, directoryToScan, pattern);
  }

  logger.info`Preparing tests for ${testFiles.length} files.`;
  for (const testFilePath of testFiles) {
    const absolutePath = path.resolve(`${relPath}/${testFilePath}`);

    if (ignoredPatterns.some((x) => absolutePath.includes(x))) {
      logger.log`Ignoring: ${absolutePath}`;
      continue;
    }

    let testFileContent: testFile.Content;
    if (absolutePath.endsWith(testFile.BIN)) {
      const content: Buffer = await fs.readFile(absolutePath);
      testFileContent = {
        kind: '.bin',
        content: new Uint8Array(content),
      };
    } else {
      const content = await fs.readFile(absolutePath, "utf8");
      testFileContent = {
        kind: '.json',
        content,
      };
    }

    const testVariants = prepareTest(runners, testFileContent, testFilePath, absolutePath);
    for (const test of testVariants) {
      test.shouldSkip = accepted !== undefined && !accepted.some((x) => absolutePath.includes(x));
      tests.push(test);
    }
  }

  // aggregate the tests by their runner.
  const aggregated = new Map<string, TestAndRunner<unknown>[]>();
  for (const test of tests) {
    const sameRunner = aggregated.get(test.runner) ?? [];
    sameRunner.push(test);
    aggregated.set(test.runner, sameRunner);
  }

  const pathToReplace = new RegExp(`/.*${directoryToScan}/`);

  logger.info`Running ${tests.length} tests.`;
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
        logger.info`Running ${testName}`;
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
              const testCase = runner.variant !== null ? `[${runner.variant}] ${fileName}` : fileName;
              if (runner.shouldSkip) {
                test.it.skip(testCase, runner.test);
              } else {
                test.it(testCase, { timeout }, runner.test);
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
  try {
    const files = await fs.readdir(`${relPath}/${dir}`, {
      recursive: true,
    });
    return files.filter((f) => f.endsWith(filePattern)).map((f) => `${dir}/${f}`);
  } catch (e) {
    logger.error`Unable to find test vectors in ${relPath}/${dir}: ${e}`;
    return [];
  }
}

type TestAndRunner<V> = {
  shouldSkip: boolean;
  runner: string;
  file: string;
  variant: V;
  test: (ctx: TestContext) => Promise<void>;
};

function prepareTest<T, V>(
  runners: Runner<T, V>[],
  testContent: testFile.Content,
  fileName: string,
  fullPath: string
): TestAndRunner<V>[] {
  const errors: [string, unknown][] = [];
  const handleError = (name: string, e: unknown) => errors.push([name, e]);
  // NOTE This is not safe, but if the test does not specify
  // variants it means it doesn't care about them.
  const noneVariant = '' as V;

  // Find the first runner that is able to parse the input data.
  for (const { path, parser, run, variants, chainSpecs } of runners) {
    // NOTE: this `if` statement is intended to speed up parsing of the test files
    // instead of trying each and every runner, we make sure that the absolute
    // path to the file includes each part of our "test path" definition.
    if (!path.split("/").every((pathPart) => fullPath.includes(pathPart))) {
      continue;
    }

    for (const chainSpec of chainSpecs) {
      if (parser.kind === testFile.BIN && testContent.kind === testFile.BIN) {
        try {
          const parsedTest = Decoder.decodeObject(parser.codec, testContent.content, chainSpec);
          return createTestDefinitions(path, run, variants, parsedTest, chainSpec);
        } catch (e) {
          handleError(path, e);
        }
      }

      if (parser.kind === testFile.JSON && testContent.kind === testFile.JSON) {
        try {
          const parsedTest = parseFromJson(testContent.content, parser.fromJson);
          return createTestDefinitions(path, run, variants, parsedTest, chainSpec);
        } catch (e) {
          handleError(path, e);
        }
      }

      if (testContent.kind !== parser.kind) {
        handleError(path, new Error(`Mismatching parser: got ${parser.kind}, need: ${testContent.kind}`));
      }
    }
  }

  return [
    {
      shouldSkip: false,
      runner: "Invalid",
      file: fileName,
      variant: noneVariant,
      test: () => {
        for (const [runner, error] of errors) {
          logger.error`[${runner}] Parsing error: ${error}`;
        }

        fail(`Unrecognized test case in ${fileName}`);
      },
    },
  ];

  function createTestDefinitions(
    path: string,
    run: RunFunction<T, V>,
    variants: V[],
    parsedTest: T,
    chainSpec: ChainSpec
  ) {
    const results: TestAndRunner<V>[] = [];
    const possibleVariants: V[] = variants.length === 0 ? [noneVariant] : variants;

    for (const variant of possibleVariants) {
      results.push({
        shouldSkip: false,
        runner: path,
        file: fileName,
        variant,
        test: (ctx) => {
          logger.log`[${path}:${variant}] running test from ${fileName} (spec: ${chainSpec.name})`;
          logger.trace` ${util.inspect(parsedTest, true, 2)}`;
          return run(parsedTest, variant, {
            test: ctx,
            path: fullPath,
            chainSpec,
          });
        },
      });
    }
    return results;
  };
}
