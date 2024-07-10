import type { TestContext } from "node:test";

type Status = "trap";

type GrowToSize<T, N extends number, A extends T[]> = A["length"] extends N
	? A
	: GrowToSize<T, N, [...A, T]>;

export type FixedArray<T, N extends number> = GrowToSize<T, N, []>;

export type PvmTest = {
	name: string;
	"initial-regs": FixedArray<number, 13>;
	"initial-pc": number;
	"initial-page-map": Array<unknown>;
	"initial-memory": Array<unknown>;
	"initial-gas": number;
	program: Array<number>;
	"expected-status": Status;
	"expected-regs": FixedArray<number, 13>;
	"expected-pc": number;
	"expected-memory": Array<unknown>;
	"expected-gas": number;
};

const testKeys: Array<keyof PvmTest> = [
	"name",
	"initial-regs",
	"initial-pc",
	"initial-page-map",
	"initial-memory",
	"initial-gas",
	"program",
	"expected-status",
	"expected-regs",
	"expected-pc",
	"expected-pc",
	"expected-memory",
	"expected-gas",
];

export function isPvmTest(testContent): testContent is PvmTest {
	if (typeof testContent !== "object" || testContent === null) return false;
	return testKeys.every((key) => testContent.hasOwnProperty(key));
}

export function runPvmTest(t: TestContext, testContent: PvmTest) {
	t.todo("implement me");
}
