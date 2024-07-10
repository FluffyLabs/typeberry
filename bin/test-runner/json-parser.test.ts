import { test } from "node:test";
import assert from "node:assert";
import { type FromJson, parseFromJson } from "./json-parser";

test("JSON parser", async (t) => {
	await t.test("parse simple class", () => {
		const json = `{"k": 5, "v": true }`;
		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: "number",
				v: "boolean",
			};

			k = 0;
			v = false;
		}

		const result = parseFromJson<TestClass>(
			JSON.parse(json),
			TestClass.fromJson,
		);
		assert.strictEqual(result.k, 5);
		assert.strictEqual(result.v, true);
	});

	await t.test("parse nested object", () => {
		const json = `{"k": "xyz", "nested": { "k": 5, "v": true }}`;
		class NestedClass {
			static fromJson: FromJson<NestedClass> = {
				k: "number",
				v: "boolean",
			};
			k = 0;
			v = false;
		}

		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: "string",
				nested: NestedClass.fromJson,
			};

			k = "";
			nested: NestedClass = new NestedClass();
		}

		const result = parseFromJson<TestClass>(
			JSON.parse(json),
			TestClass.fromJson,
		);
		assert.strictEqual(result.k, "xyz");
		assert.deepEqual(result.nested, {
			k: 5,
			v: true,
		});
	});

	await t.test("parse & process", () => {
		const json = `{"k": "0x123", "v": true }`;
		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: ["string", (v: string) => Number.parseInt(v)],
				v: "boolean",
			};

			k = 0;
			v = false;
		}

		const result = parseFromJson<TestClass>(
			JSON.parse(json),
			TestClass.fromJson,
		);
		assert.strictEqual(result.k, 0x123);
		assert.strictEqual(result.v, true);
	});

	// TODO [ToDr] Negative cases
});
