import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import type { TestContext } from "node:test";
import { type FromJson, parseFromJson } from "./test-runner/json-parser";
import { PvmTest, runPvmTest } from "./test-runner/pvm";
import { SafroleTest, runSafroleTest } from "./test-runner/safrole";

main().then(console.log).catch(console.error);

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
}

function tryToPrepareTestRunner<T>(
	testContent: unknown,
	fromJson: FromJson<T>,
	run: (t: T) => void,
	onError: (e: unknown) => void,
) {
	try {
		const parsedTest = parseFromJson(testContent, fromJson);

		return () => {
			run(parsedTest);
		};
	} catch (e) {
		onError(e);
		return null;
	}
}

async function dispatchTest(
	t: TestContext,
	testContent: unknown,
	file: string,
) {
	const errors: unknown[] = [];
	const handleError = (e: unknown) => errors.push(e);

	const runners = [
		tryToPrepareTestRunner(
			testContent,
			SafroleTest.fromJson,
			runSafroleTest,
			handleError,
		),
		tryToPrepareTestRunner(
			testContent,
			PvmTest.fromJson,
			runPvmTest,
			handleError,
		),
	];

	function nonNull<T>(x: T | null): x is T {
		return x !== null;
	}
	const nonEmptyRunners = runners.filter(nonNull);

	if (nonEmptyRunners.length === 0) {
		for (const error of errors) {
			console.error(error);
		}

		fail(`Unrecognized test case in ${file}`);
	} else {
		for (const runner of nonEmptyRunners) {
			runner();
		}
	}
}
