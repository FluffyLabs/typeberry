import { fail } from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import type { TestContext } from "node:test";
import { SafroleTest, runSafroleTest } from "./test-runner/safrole";
import { parseFromJson } from "./test-runner/json-parser";

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

async function dispatchTest(
	t: TestContext,
	testContent: unknown,
	file: string,
) {
	try {
		const safroleTest = parseFromJson<SafroleTest>(
			testContent,
			SafroleTest.fromJson,
		);
		runSafroleTest(t, safroleTest);
	} catch (e) {
		fail(`Not a safrole test: ${e}`);
	}
	fail(`Unrecognized test case in ${file}`);
}
