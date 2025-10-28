import "json-bigint-patch";

import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import util from "node:util";
import { type Decode, Decoder } from "@typeberry/codec";
import { type ChainSpec, tinyChainSpec } from "@typeberry/config";
import { initWasm } from "@typeberry/crypto";
import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { Level, Logger } from "@typeberry/logger";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
export const logger = Logger.new(import.meta.filename, "test-runner");

export class RunnerBuilder<T, V> implements Runner<T, V> {
  public readonly parsers: testFile.Kind<T>[] = [];
  public readonly variants: V[] = [];
  public readonly chainSpecs: ChainSpec[] = [];

  constructor(
    public readonly path: string,
    public readonly run: RunFunction<T, V>,
  ) {}

  fromJson(fromJson: FromJson<T>) {
    this.parsers.push({ kind: testFile.json, fromJson });
    return this;
  }

  fromBin(codec: Decode<T>) {
    this.parsers.push({ kind: testFile.bin, codec });
    return this;
  }

  withChainSpecDetection(chainSpec: ChainSpec[]) {
    this.chainSpecs.push(...chainSpec);
    return this;
  }

  withVariants(variants: V[]) {
    this.variants.push(...variants);
    return this;
  }

  build(): Runner<unknown, unknown> {
    const { path, run, parsers, variants, chainSpecs } = this;
    if (parsers.length === 0) {
      throw new Error(`No parsers for ${path}!`);
    }

    return {
      path,
      run,
      parsers,
      variants,
      chainSpecs,
    } as Runner<unknown, unknown>;
  }
}

/** Test runner builder function. */
export function runner<T, V = never>(path: string, run: RunFunction<T, V>, chainSpecs?: ChainSpec[]) {
  const builder = new RunnerBuilder(path, run);
  if (chainSpecs !== undefined) {
    return builder.withChainSpecDetection(chainSpecs);
  }
  return builder;
}

export type RunOptions = {
  test: TestContext;
  chainSpec: ChainSpec;
  path: string;
};

export type RunFunction<T, V> = (test: T, options: RunOptions, variant: V) => Promise<void>;

export type Runner<T, V> = {
  path: string;
  parsers: testFile.Kind<T>[];
  run: RunFunction<T, V>;
  variants: V[];
  chainSpecs: ChainSpec[];
};

export namespace testFile {
  export const json = ".json";
  export type json = typeof json;
  export const bin = ".bin";
  export type bin = typeof bin;

  export type Kind<T> =
    | {
        kind: json;
        fromJson: FromJson<T>;
      }
    | {
        kind: bin;
        codec: Decode<T>;
      };

  export type Content =
    | {
        kind: json;
        content: unknown;
      }
    | {
        kind: bin;
        content: Uint8Array;
      };
}

export async function main(
  runners: Runner<unknown, unknown>[],
  initialFiles: string[],
  directoryToScan: string,
  {
    pattern = testFile.json,
    accepted,
    ignored,
  }: {
    pattern?: testFile.json | testFile.bin;
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
    if (absolutePath.endsWith(testFile.bin)) {
      const content: Buffer = await fs.readFile(absolutePath);
      testFileContent = {
        kind: ".bin",
        content: new Uint8Array(content),
      };
    } else {
      const content = await fs.readFile(absolutePath, "utf8");
      testFileContent = {
        kind: ".json",
        content: JSON.parse(content),
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
              const testCase = `${runner.variant}` !== "" ? `[${runner.variant}] ${fileName}` : fileName;
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
  fullPath: string,
): TestAndRunner<V>[] {
  const errors: [string, unknown][] = [];
  const handleError = (name: string, e: unknown) => errors.push([name, e]);
  // NOTE This is not safe, but if the test does not specify
  // variants it means it doesn't care about them.
  const noneVariant = "" as V;

  // Find the first runner that is able to parse the input data.
  for (const { path, parsers, run, variants, chainSpecs } of runners) {
    const specs = chainSpecs.length > 0 ? chainSpecs : [tinyChainSpec];
    const matchPath = chainSpecs.length > 0;
    for (const chainSpec of specs) {
      // NOTE: this `if` statement is intended to speed up parsing of the test files
      // instead of trying each and every runner, we make sure that the absolute
      // path to the file includes each part of our "test path" definition.
      if (!path.split("/").every((pathPart) => fullPath.includes(pathPart))) {
        continue;
      }
      // if we care about the chain spec, we also need to match the path
      if (matchPath && !fullPath.includes(chainSpec.name)) {
        continue;
      }

      for (const parser of parsers) {
        if (parser.kind === testFile.bin && testContent.kind === testFile.bin) {
          try {
            const parsedTest = Decoder.decodeObject(parser.codec, testContent.content, chainSpec);
            return createTestDefinitions(path, run, variants, parsedTest, chainSpec);
          } catch (e) {
            handleError(path, e);
          }
        }

        if (parser.kind === testFile.json && testContent.kind === testFile.json) {
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
    chainSpec: ChainSpec,
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
          return run(
            parsedTest,
            {
              test: ctx,
              path: fullPath,
              chainSpec,
            },
            variant,
          );
        },
      });
    }
    return results;
  }
}
