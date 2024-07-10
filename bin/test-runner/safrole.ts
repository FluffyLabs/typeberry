import assert from "node:assert";
import type { TestContext } from "node:test";
import { Bytes, BytesBlob } from "../../packages/bytes";
import type {
	BandersnatchKey,
	BlsKey,
	Ed25519Key,
} from "../../packages/crypto";
import type { EntropyHash } from "../../packages/hash";
import {
	Safrole,
	type TicketBody,
	type TicketEnvelope,
	type ValidatorData,
} from "../../packages/safrole";
import { type FromJson, optional, parseFromJson } from "./json-parser";

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
	? `${T}${Capitalize<SnakeToCamel<U>>}`
	: S;

type ConvertKeysToCamelCase<T> = {
	[K in keyof T as SnakeToCamel<K & string>]: T[K];
};

type PlainObjectToClass<T> = {
	[K in keyof T]: () => T[K];
};

function snakeToCamel<T extends string>(s: T): SnakeToCamel<T> {
	return s.replace(/(_\w)/g, (matches) =>
		matches[1].toUpperCase(),
	) as SnakeToCamel<T>;
}

function convertJsonObjectToClass<T extends object>(
	json: T,
): PlainObjectToClass<ConvertKeysToCamelCase<T>> {
	const clazz = {} as { [key: string]: unknown };
	for (const [k, v] of Object.entries(json)) {
		clazz[snakeToCamel(k)] = () => v;
	}
	return clazz as PlainObjectToClass<ConvertKeysToCamelCase<T>>;
}

const entropyHashFromJson: FromJson<EntropyHash> = [
	"string",
	(v: string) => Bytes.parseBytes(v, 32) as EntropyHash,
];

const validatorDataFromJson: FromJson<ValidatorData> = {
	ed25519: ["string", (v: string) => Bytes.parseBytes(v, 32) as Ed25519Key],
	bandersnatch: [
		"string",
		(v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey,
	],
	bls: ["string", (v: string) => Bytes.parseBytes(v, 144) as BlsKey],
	metadata: ["string", BytesBlob.parseBlob],
};

const ticketBodyFromJson: FromJson<TicketBody> = {
	id: ["string", (v: string) => Bytes.parseBytes(v, 32)],
	attempt: "number",
};

export class TicketsOrKeys {
	static fromJson = optional<TicketsOrKeys>({
		tickets: ["array", ticketBodyFromJson],
		keys: [
			"array",
			["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey],
		],
	});
	tickets?: TicketBody[];
	keys?: BandersnatchKey[];
}

const ticketEnvelopeFromJson: FromJson<TicketEnvelope> = {
	attempt: "number",
	signature: ["string", (v: string) => Bytes.parseBytes(v, 784)],
};

class JsonState {
	static fromJson: FromJson<JsonState> = {
		timeslot: "number",
		entropy: ["array", entropyHashFromJson],
		prev_validators: ["array", validatorDataFromJson],
		curr_validators: ["array", validatorDataFromJson],
		next_validators: ["array", validatorDataFromJson],
		designed_validators: ["array", validatorDataFromJson],
		tickets_accumulator: ["array", ticketBodyFromJson],
		tickets_or_keys: TicketsOrKeys.fromJson,
		tickets_verifier_key: ["string", (v: string) => Bytes.parseBytes(v, 384)],
	};
	timeslot!: number;
	entropy!: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
	prev_validators!: ValidatorData[];
	curr_validators!: ValidatorData[];
	next_validators!: ValidatorData[];
	designed_validators!: ValidatorData[];
	tickets_accumulator!: TicketBody[];
	tickets_or_keys!: TicketsOrKeys;
	tickets_verifier_key!: Bytes<384>;
}

export class EpochMark {
	static fromJson: FromJson<EpochMark> = {
		entropy: entropyHashFromJson,
		validators: [
			"array",
			["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey],
		],
	};

	entropy!: EntropyHash;
	validators!: BandersnatchKey[];
}

export class OkOutput {
	static fromJson = optional<OkOutput>({
		epoch_mark: EpochMark.fromJson,
		tickets_mark: ["array", ticketBodyFromJson],
	});
	epoch_mark?: EpochMark;
	tickets_mark?: TicketBody[];
}

export class Output {
	static fromJson = optional<Output>({
		ok: OkOutput.fromJson,
		err: "number",
	});

	ok?: OkOutput = undefined;
	err?: number = 0;
}

export class SafroleTest {
	static fromJson: FromJson<SafroleTest> = {
		input: {
			slot: "number",
			entropy: entropyHashFromJson,
			extrinsics: ["array", ticketEnvelopeFromJson],
		},
		pre_state: JsonState.fromJson,
		output: Output.fromJson,
		post_state: JsonState.fromJson,
	};

	input!: {
		slot: number;
		entropy: EntropyHash;
		extrinsics: TicketEnvelope[];
	};
	pre_state!: JsonState;
	output!: Output;
	post_state!: JsonState;
}

export function runSafroleTest(testContent: SafroleTest) {
	const preState = convertJsonObjectToClass(testContent.pre_state);
	const postState = convertJsonObjectToClass(testContent.post_state);
	const safrole = new Safrole(preState);

	const output = safrole.transition(testContent.input);

	assert.deepEqual(output, testContent.output);
	assert.deepEqual(safrole.currentState(), postState);
}
