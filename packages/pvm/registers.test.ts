import assert from "node:assert";
import { test } from "node:test";
import { Registers } from "./registers";

test("Registers", async (t) => {
	await t.test("loading 32 bit integer into register", () => {
		const registers = new Registers();
		const expectedNumber = -1;

		registers.set(0, 0xff_ff_ff_ff);

		assert.strictEqual(registers.get(0), BigInt(expectedNumber));
	});
});
