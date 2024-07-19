import assert from "node:assert";
import {Bytes, BytesBlob} from "../../packages/bytes"
import {TrieRoot} from "../../packages/hash"
import {FromJson} from "./json-parser";

export class TrieTest {
	static fromJson: FromJson<TrieTest> = {
		input: ['object', (input: unknown, context?: string): Map<Bytes<32>, BytesBlob> => {
			if (input === null) {
				throw new Error(`[${context}] Unexpected 'null'`);
			}
			if (typeof input !== 'object') {
				throw new Error(`[${context}] Expected an object.`);
			}

			const output: Map<Bytes<32>, BytesBlob> = new Map();
			for (const [k, v] of Object.entries(input)) {
				const key = Bytes.parseBytesNoPrefix(k, 32);
				const value = BytesBlob.parseBlobNoPrefix(v);
				output.set(key, value);
			}

			return output;
		}],
		output: ['string', (v: string) => Bytes.parseBytesNoPrefix(v, 32) as TrieRoot],
	};
	input!: Map<Bytes<32>, BytesBlob>;
	output!: TrieRoot;
};

export type TrieTestSuite = [TrieTest];
export const trieTestSuiteFromJson: FromJson<TrieTestSuite> = ['array', TrieTest.fromJson];

export async function runTrieTest(testContent: TrieTestSuite) {
	for (const test of testContent) {
		assert.strictEqual(test.output, Bytes.parseBytes("0x0000000000000000000000000000000000000000000000000000000000000000", 32));
	}
}

