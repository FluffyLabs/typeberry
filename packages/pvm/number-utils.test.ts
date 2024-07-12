import assert from "node:assert";
import { test } from "node:test";

import { decodeImmediate } from "./numer-utils";

test("decodeImmediate", async (t) => {
	await t.test("Positive number without elided octets", () => {
		const encodedBytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
		const expected = 1;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Negative number without elided octets", () => {
		const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
		const expected = -1;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Positive number with elided octets", () => {
		const encodedBytes = new Uint8Array([0x01]);
		const expected = 1;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Negative number with elided octets", () => {
		const encodedBytes = new Uint8Array([0xff]);
		const expected = -1;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Large positive number without elided octets", () => {
		const encodedBytes = new Uint8Array([0xff, 0xff, 0x7f, 0x00]);
		const expected = 0x007fffff;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Large negative number without elided octets", () => {
		const encodedBytes = new Uint8Array([0x01, 0x00, 0x80, 0xff]);
		const expected = -0x007fffff;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Maximum positive value", () => {
		const encodedBytes = new Uint8Array([0xff, 0xff, 0xff, 0x7f]);
		const expected = 0x7fffffff;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});

	await t.test("Maximum negative value", () => {
		const encodedBytes = new Uint8Array([0x00, 0x00, 0x00, 0x80]);
		const expected = -0x80000000;
		assert.equal(decodeImmediate(encodedBytes), expected);
	});
});
