import { test } from "node:test";
import assert from "node:assert";

test("Hello Block", async (t) => {
	t.test("subtest", () => {
		assert.strictEqual(1, 1);
	});
});
