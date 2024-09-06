import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import type { TestContext } from "node:test";
import { newLogger } from "@typeberry/logger";
import {
  EcTest,
  PageProof,
  SegmentEcTest,
  SegmentRoot,
  runEcTest,
  runPageProofTest,
  runSegmentEcTest,
  runSegmentRootTest,
} from "@typeberry/test-runner";
import { type FromJson, parseFromJson } from "@typeberry/test-runner/json-parser";
import { PvmTest, runPvmTest } from "@typeberry/test-runner/pvm";
import { SafroleTest, runSafroleTest } from "@typeberry/test-runner/safrole";
import { runTrieTest, trieTestSuiteFromJson } from "@typeberry/test-runner/trie";

const logger = newLogger(__filename);

main().then(logger.log).catch(logger.error);

async function main() {
  const files = process.argv.slice(2);
  for (const file of files) {
    const data = await fs.readFile(file, "utf8");
    test(`Test of ${file}`, async (t) => {
      // TODO [ToDr] We might want to implement a custom JSON parser
      // to avoid-double converting to expected types.
      const testContent = JSON.parse(data);
      await dispatchTest(t, testContent, file);
    });
  }

  return "Tests have been executed";
}

function tryToPrepareTestRunner<T>(
  testContent: unknown,
  fromJson: FromJson<T>,
  run: (t: T) => Promise<void>,
  onError: (e: unknown) => void,
) {
  try {
    const parsedTest = parseFromJson(testContent, fromJson);

    return async () => {
      await run(parsedTest);
    };
  } catch (e) {
    onError(e);
    return null;
  }
}

async function dispatchTest(_t: TestContext, testContent: unknown, file: string) {
  const errors: unknown[] = [];
  const handleError = (e: unknown) => errors.push(e);

  function prepRunner<T>(fromJson: FromJson<T>, run: (t: T) => Promise<void>) {
    return tryToPrepareTestRunner(testContent, fromJson, run, handleError);
  }

  const runners = [
    prepRunner(SafroleTest.fromJson, runSafroleTest),
    prepRunner(PvmTest.fromJson, runPvmTest),
    prepRunner(trieTestSuiteFromJson, runTrieTest),
    prepRunner(EcTest.fromJson, runEcTest),
    prepRunner(PageProof.fromJson, runPageProofTest),
    prepRunner(SegmentEcTest.fromJson, runSegmentEcTest),
    prepRunner(SegmentRoot.fromJson, runSegmentRootTest),
  ];

  function nonNull<T>(x: T | null): x is T {
    return x !== null;
  }
  const nonEmptyRunners = runners.filter(nonNull);

  if (nonEmptyRunners.length === 0) {
    for (const error of errors) {
      logger.error(error);
    }

    fail(`Unrecognized test case in ${file}`);
  } else {
    const promises: Promise<void>[] = [];
    for (const runner of nonEmptyRunners) {
      promises.push(runner());
    }
    await Promise.all(promises);
  }
}
