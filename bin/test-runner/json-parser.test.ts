import { test } from "node:test";
import assert from "node:assert";
import {FromJson, parseFromJson} from "./json-parser";


test("JSON parser", async (t) => {
	t.test('parse simple class', () => {
		const json = `{"k": 5, "v": true }`;
		class TestClass {
			static keys: FromJson<TestClass> = {
				k: 'number',
				v: 'boolean',
			};

			k: number = 0;
			v: boolean = false;
		}

		const result = parseFromJson<TestClass>(JSON.parse(json), TestClass.keys);
		assert.strictEqual(result.k, 5);
		assert.strictEqual(result.v, true);
	});

	t.test('parse nested object', () => {
	
	});
});
