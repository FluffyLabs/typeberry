import assert from "node:assert";
import { test } from "node:test";
import { type FromJson, optional, parseFromJson } from "./json-parser";

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
		assert.deepStrictEqual(result.nested, {
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

	await t.test("arrays", () => {
		const json = `{"k": ["a", "b", "c"]}`;
		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: ["array", "string"],
			};

			k!: string[];
		}

		const result = parseFromJson<TestClass>(
			JSON.parse(json),
			TestClass.fromJson,
		);
		assert.deepStrictEqual(result.k, ["a", "b", "c"]);
	});

	await t.test("keys mismatch", () => {
		const json = `{"x": 5, "v": true }`;
		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: "number",
				v: "boolean",
			};

			k = 0;
			v = false;
		}

		try {
			parseFromJson<TestClass>(JSON.parse(json), TestClass.fromJson);
			assert.fail("Expected error to be thrown");
		} catch (e) {
			assert.strictEqual(
				`${e}`,
				`Error: [<root>] Unexpected or missing keys: <missing>,"k" | "x",<missing> {"x":5,"v":true} {"k":"number","v":"boolean"}`,
			);
		}
	});

	await t.test("type mismatch", () => {
		const json = `{"k": "sdf", "v": true }`;
		class TestClass {
			static fromJson: FromJson<TestClass> = {
				k: "number",
				v: "boolean",
			};

			k = 0;
			v = false;
		}

		try {
			parseFromJson<TestClass>(JSON.parse(json), TestClass.fromJson);
			assert.fail("Expected error to be thrown");
		} catch (e) {
			assert.strictEqual(
				`${e}`,
				"Error: [<root>.k] Expected number but got string",
			);
		}
	});

	await t.test("optionals", () => {
		const json = `{"v": true }`;
		class TestClass {
			static fromJson = optional<TestClass>({
				k: "number",
				v: "boolean",
			});

			k?: number;
			v?: boolean;
		}

		const result = parseFromJson<TestClass>(
			JSON.parse(json),
			TestClass.fromJson,
		);

		assert.strictEqual(result.k, undefined);
		assert.strictEqual(result.v, true);
	});
});
