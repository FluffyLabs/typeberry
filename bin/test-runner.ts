import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import type { TestContext } from "node:test";
import { parseFromJson } from "./test-runner/json-parser";
import { SafroleTest, runSafroleTest } from "./test-runner/safrole";
import { PvmTest, runPvmTest } from "./test-runner/pvm";

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

function handleSafroleTest(t: TestContext, testContent: unknown, file: string) {
	try {
		const safroleTest = parseFromJson<SafroleTest>(
			testContent,
			SafroleTest.fromJson,
		);
		return () => runSafroleTest(t, safroleTest);
	} catch (e) {
		throw e;
	}
}

function handlePvmTest(t: TestContext, testContent: unknown, file: string) {
	try {
		const pvmTest = parseFromJson<PvmTest>(testContent, PvmTest.fromJson);
		return () => runPvmTest(t, pvmTest);
	} catch (e) {
		throw e;
	}
}

async function dispatchTest(
	t: TestContext,
	testContent: unknown,
	file: string,
) {
	const handlers = [handleSafroleTest, handlePvmTest];

	const errors: unknown[] = [];
	const runners: Function[] = [];
	handlers.forEach((handler) => {
		try {
			const runner = handler(t, testContent, file);
			runners.push(runner);
		} catch (e) {
			errors.push(e);
		}
	});

	if (runners.length === 0) {
		errors.forEach((e) => {
			console.error(e);
		});
		fail(`Unrecognized test case in ${file}`);
	}

	runners.forEach((runner) => {
		runner();
	});
}
