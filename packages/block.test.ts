import assert from "node:assert";
import { test } from "node:test";

test("Hello Block", async (t) => {
	t.test("subtest", () => {
		assert.strictEqual(1, 1);
	});
});
