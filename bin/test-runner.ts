import { test } from "node:test";
import { fail } from "node:assert";
import * as fs from "node:fs/promises";

import type { TestContext } from "node:test";
import {
	isSafroleTest,
	type SafroleTest,
	runSafroleTest,
} from "./test-runner/safrole";

main().then(console.log).catch(console.error);

async function main() {
	const files = process.argv.slice(2);
	for (const file of files) {
		const data = await fs.readFile(file, "utf8");
		test(`Test of ${file}`, async (t) => {
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
	if (isSafroleTest(testContent)) {
		runSafroleTest(t, testContent);
	} else {
		fail(`Unrecognized test case in ${file}`);
	}
}
