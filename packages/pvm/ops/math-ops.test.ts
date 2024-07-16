import assert from "node:assert";
import { test } from "node:test";

import { Registers } from "../registers";
import { MAX_VALUE } from "./math-consts";
import { MathOps } from "./math-ops";

const FIRST_REGISTER = 0;
const SECOND_REGISTER = 1;
const RESULT_REGISTER = 12;

const getRegisters = (data: number[]) => {
	const regs = new Registers();

	for (const [i, byte] of data.entries()) {
		regs.asUnsigned[i] = byte;
	}

	return regs;
};

test("MathOps", async (t) => {
	await t.test("add", () => {
		const firstValue = 12;
		const secondValue = 13;
		const resultValue = 25;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.add(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("add with overflow", () => {
		const firstValue = MAX_VALUE;
		const secondValue = 13;
		const resultValue = 12;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.add(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("addImmediate", () => {
		const firstValue = 12;
		const secondValue = 13;
		const resultValue = 25;
		const regs = getRegisters([firstValue]);
		const mathOps = new MathOps(regs);

		mathOps.addImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("addImmediate with overflow", () => {
		const firstValue = MAX_VALUE;
		const secondValue = 13;
		const resultValue = 12;
		const regs = getRegisters([firstValue]);
		const mathOps = new MathOps(regs);

		mathOps.addImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("sub", () => {
		const firstValue = 12;
		const secondValue = 13;
		const resultValue = 1;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.sub(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("sub with overflow", () => {
		const firstValue = 13;
		const secondValue = 12;
		const resultValue = MAX_VALUE;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.sub(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("mul", () => {
		const firstValue = 12;
		const secondValue = 13;
		const resultValue = 156;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.mul(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("mul with overflow", () => {
		const firstValue = 2 ** 17 + 1;
		const secondValue = 2 ** 18;
		const resultValue = 262144;
		const regs = getRegisters([firstValue, secondValue]);
		const mathOps = new MathOps(regs);

		mathOps.mul(FIRST_REGISTER, SECOND_REGISTER, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("mulImmediate", () => {
		const firstValue = 12;
		const secondValue = 13;
		const resultValue = 156;
		const regs = getRegisters([firstValue]);
		const mathOps = new MathOps(regs);

		mathOps.mulImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});

	await t.test("mulImmediate with overflow", () => {
		const firstValue = 2 ** 17 + 1;
		const secondValue = 2 ** 18;
		const resultValue = 262144;
		const regs = getRegisters([firstValue]);
		const mathOps = new MathOps(regs);

		mathOps.mulImmediate(FIRST_REGISTER, secondValue, RESULT_REGISTER);

		assert.strictEqual(regs.asUnsigned[RESULT_REGISTER], resultValue);
	});
});
