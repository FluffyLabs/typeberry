import assert from "node:assert";
import { test } from "node:test";

import { decodeNaturalNumber } from "./decode-natural-number";

test("decodeNaturalNumber", async (t) => {
	await t.test("decode 0", () => {
		const encodedBytes = new Uint8Array([0]);
		const expectedValue = 0n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});

	await t.test("decode single byte min value", () => {
		const encodedBytes = new Uint8Array([1]);
		const expectedValue = 1n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});

	await t.test("decode single byte max value", () => {
		const encodedBytes = new Uint8Array([127]);
		const expectedValue = 127n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});

	await t.test("decode 2 bytes min value", () => {
		const encodedBytes = new Uint8Array([128, 128]);
		const expectedValue = 128n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});

	await t.test("decode 2 bytes max value", () => {
		const encodedBytes = new Uint8Array([191, 255]);
		const expectedValue = 2n ** 14n - 1n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});

	await t.test("decode 8 bytes max value", () => {
		const encodedBytes = new Uint8Array([
			255, 255, 255, 255, 255, 255, 255, 255, 255,
		]);
		const expectedValue = 2n ** 64n - 1n;

		const result = decodeNaturalNumber(encodedBytes);

		assert.strictEqual(result.value, expectedValue);
		assert.strictEqual(result.bytesToSkip, encodedBytes.length);
	});
});
