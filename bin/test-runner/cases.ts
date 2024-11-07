import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { type FromJson, parseFromJson } from "@typeberry/json-parser";
import { Level, Logger } from "@typeberry/logger";
import { assurancesExtrinsicFromJson, runAssurancesExtrinsicTest } from "./tests/codec/assurances-extrinsic";
import { blockFromJson, runBlockTest } from "./tests/codec/block";
import { disputesExtrinsicFromJson, runDisputesExtrinsicTest } from "./tests/codec/disputes-extrinsic";
import { extrinsicFromJson, runExtrinsicTest } from "./tests/codec/extrinsic";
import { guaranteesExtrinsicFromJson, runGuaranteesExtrinsicTest } from "./tests/codec/guarantees-extrinsic";
import { headerFromJson, runHeaderTest } from "./tests/codec/header";
import { preimagesExtrinsicFromJson, runPreimagesExtrinsicTest } from "./tests/codec/preimages-extrinsic";
import { refineContextFromJson, runRefineContextTest } from "./tests/codec/refine-context";
import { runTicketsExtrinsicTest, ticketsExtrinsicFromJson } from "./tests/codec/tickets-extrinsic";
import { runWorkItemTest, workItemFromJson } from "./tests/codec/work-item";
import { runWorkPackageTest, workPackageFromJson } from "./tests/codec/work-package";
import { runWorkReportTest, workReportFromJson } from "./tests/codec/work-report";
import { runWorkResultTest, workResultFromJson } from "./tests/codec/work-result";
import { DisputesTest, runDisputesFullTest, runDisputesTinyTest } from "./tests/disputes";
import {
  EcTest,
  PageProof,
  SegmentEcTest,
  SegmentRoot,
  runEcTest,
  runPageProofTest,
  runSegmentEcTest,
  runSegmentRootTest,
} from "./tests/erasure-coding";
import { PvmTest, runPvmTest } from "./tests/pvm";
import { SafroleTest, runSafroleTest } from "./tests/safrole";
import { JsonSchema, ignoreSchemaFiles } from "./tests/schema";
import { runTrieTest, trieTestSuiteFromJson } from "./tests/trie";

Logger.configureAll(process.env.JAM_LOG ?? "", Level.LOG);
const logger = Logger.new(__filename, "test-runner");

main()
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(e);
    process.exit(-1);
  });

async function main() {
  const relPath = `${__dirname}/../..`;
  let files = process.argv.slice(2);
  const tests: TestAndRunner[] = [];

  if (files.length === 0) {
    // scan the jamtestvectors directory
    files = await scanDir(relPath, "jamtestvectors", ".json");
  }

  logger.info(`Creating tests for ${files.length} files.`);
  for (const file of files) {
    const absolutePath = path.resolve(`${relPath}/${file}`);
    const data = await fs.readFile(absolutePath, "utf8");
    // TODO [ToDr] We might want to implement a custom JSON parser
    // to avoid-double converting to expected types.
    const testContent = JSON.parse(data);
    const testCases = prepareTests(testContent, file, absolutePath);

    tests.push(...testCases);
  }

  // now we're going to aggregate the tests by their runner.
  const aggregated = new Map<string, TestAndRunner[]>();
  for (const test of tests) {
    const sameRunner = aggregated.get(test.runner) ?? [];
    sameRunner.push(test);
    aggregated.set(test.runner, sameRunner);
  }

  logger.info(`Running all tests (${tests.length}).`);
  // we have all of the tests now, let's run them in parallel and generate results.
  for (const [key, values] of aggregated.entries()) {
    // split large suites into parts to run them in parallel
    const perPart = key === "safrole" ? 5 : 50;
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
              const fileName = subTest.file.replace(/.*jamtestvectors/, "");
              test.it(fileName, subTest.test);
            }
          },
        );
      });
    }
  }

  return "Tests registed successfuly";
}

function tryToPrepareTestRunner<T>(
  name: string,
  file: string,
  path: string,
  testContent: unknown,
  fromJson: FromJson<T>,
  run: (t: T, path: string) => Promise<void>,
  onError: (name: string, e: unknown) => void,
): TestAndRunner | null {
  try {
    const parsedTest = parseFromJson(testContent, fromJson);

    return {
      runner: name,
      file,
      test: () => run(parsedTest, path),
    };
  } catch (e) {
    onError(name, e);
    return null;
  }
}

type TestAndRunner = {
  runner: string;
  file: string;
  test: () => Promise<void>;
};

function prepareTests(testContent: unknown, file: string, path: string): TestAndRunner[] {
  const errors: [string, unknown][] = [];
  const handleError = (name: string, e: unknown) => errors.push([name, e]);

  function prepRunner<T>(name: string, fromJson: FromJson<T>, run: (t: T, path: string) => Promise<void>) {
    if (!path.includes(name)) {
      return null;
    }
    const r = tryToPrepareTestRunner(name, file, path, testContent, fromJson, run, handleError);
    return r;
  }

  const runners = [
    prepRunner("codec/assurances_extrinsic", assurancesExtrinsicFromJson, runAssurancesExtrinsicTest),
    prepRunner("codec/block", blockFromJson, runBlockTest),
    prepRunner("codec/disputes_extrinsic", disputesExtrinsicFromJson, runDisputesExtrinsicTest),
    prepRunner("codec/extrinsic", extrinsicFromJson, runExtrinsicTest),
    prepRunner("codec/guarantees_extrinsic", guaranteesExtrinsicFromJson, runGuaranteesExtrinsicTest),
    prepRunner("codec/header", headerFromJson, runHeaderTest),
    prepRunner("codec/preimages_extrinsic", preimagesExtrinsicFromJson, runPreimagesExtrinsicTest),
    prepRunner("codec/refine_context", refineContextFromJson, runRefineContextTest),
    prepRunner("codec/tickets_extrinsic", ticketsExtrinsicFromJson, runTicketsExtrinsicTest),
    prepRunner("codec/work_item", workItemFromJson, runWorkItemTest),
    prepRunner("codec/work_package", workPackageFromJson, runWorkPackageTest),
    prepRunner("codec/work_report", workReportFromJson, runWorkReportTest),
    prepRunner("codec/work_result", workResultFromJson, runWorkResultTest),
    prepRunner("disputes/tiny", DisputesTest.fromJson, runDisputesTinyTest),
    prepRunner("disputes/full", DisputesTest.fromJson, runDisputesFullTest),
    prepRunner("erasure-coding", EcTest.fromJson, runEcTest),
    prepRunner("erasure-coding/page-proof", PageProof.fromJson, runPageProofTest),
    prepRunner("erasure-coding/segment-ec", SegmentEcTest.fromJson, runSegmentEcTest),
    prepRunner("erasure-coding/segment-root", SegmentRoot.fromJson, runSegmentRootTest),
    prepRunner("ignored", JsonSchema.fromJson, ignoreSchemaFiles),
    prepRunner("pvm", PvmTest.fromJson, runPvmTest),
    prepRunner("safrole", SafroleTest.fromJson, runSafroleTest),
    prepRunner("trie", trieTestSuiteFromJson, runTrieTest),
  ];

  const nonEmptyRunners = runners.filter((x): x is TestAndRunner => x !== null);
  if (nonEmptyRunners.length > 0) {
    return nonEmptyRunners;
  }

  return [
    {
      runner: "Invalid",
      file,
      test: () => {
        for (const [runner, error] of errors) {
          logger.error(`[${runner}] Parsing error: ${error}`);
        }

        fail(`Unrecognized test case in ${file}`);
      },
    },
  ];
}

async function scanDir(relPath: string, dir: string, filePattern: string): Promise<string[]> {
  const files = await fs.readdir(`${relPath}/${dir}`, {
    recursive: true,
  });
  return files.filter((f) => f.endsWith(filePattern)).map((f) => `${dir}/${f}`);
}
