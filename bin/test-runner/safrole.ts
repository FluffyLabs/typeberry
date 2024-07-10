import type { TestContext } from "node:test";
import type { Opaque } from "../../packages/opaque";
import { type FromJson, optional, parseFromJson } from "./json-parser";
import { Ticket } from "../../packages/block";

function assert(value: boolean, description: string): asserts value is true {
	if (!value) throw new Error(description);
}

export class Blob {
	readonly buffer: ArrayBuffer = new ArrayBuffer(0);
	readonly length?: number = 0;

	static parseBlob(v: string): Blob {
		return new Blob();
	}
}

export class Bytes<T extends number> {
	readonly buffer: DataView = new DataView(new ArrayBuffer(0));
	readonly length: T;

	constructor(buffer: DataView, len: T) {
		assert(
			buffer.byteLength === len,
			`Given buffer has incorrect size ${buffer.byteLength} vs expected ${len}`,
		);
		this.buffer = buffer;
		this.length = len;
	}

	static parseBytes<X extends number>(v: string): Bytes<X> {
		return new Bytes(new DataView(new ArrayBuffer(5)), 5 as X);
	}
}

export type Hash = Bytes<32>;

export type EntropyHash = Opaque<Hash, "entropy">;
const EntropyHashFromJson: FromJson<EntropyHash> = [
	"string",
	(v: string) => Bytes.parseBytes(v) as EntropyHash,
];

export type Ed25519Key = Opaque<Bytes<32>, "ed25519">;
export type BandersnatchKey = Opaque<Bytes<32>, "BandersnatchKey">;
export type BlsKey = Opaque<Bytes<144>, "bls">;

export class ValidatorData {
	static fromJson: FromJson<ValidatorData> = {
		ed25519: ["string", (v: string) => Bytes.parseBytes(v) as Ed25519Key],
		bandersnatch: [
			"string",
			(v: string) => Bytes.parseBytes(v) as BandersnatchKey,
		],
		bls: ["string", (v: string) => Bytes.parseBytes(v) as BlsKey],
		metadata: ["string", Blob.parseBlob],
	};

	ed25519!: Ed25519Key;
	bandersnatch!: BandersnatchKey;
	bls!: BlsKey;
	metadata!: Blob;
}

export class TicketBody {
	static fromJson: FromJson<TicketBody> = {
		id: ["string", Bytes.parseBytes],
		attempt: ["number", (v: number) => Bytes.parseBytes(`${v}`) as Bytes<1>],
	};

	id!: Hash;
	attempt!: Bytes<1>;
}

export class TicketsOrKeys {
	static fromJson: FromJson<TicketsOrKeys> = [
		"object",
		(v: unknown, context?: string) => {
			if (typeof v !== "object" || v === null) {
				throw new Error(`[${context}] Missing TicketsOrKeys field.`);
			}

			if ("tickets" in v && Array.isArray(v.tickets)) {
				v.tickets = v.tickets.map((t: unknown) =>
					parseFromJson(t, TicketBody.fromJson, `${context}.tickets`),
				);
			}

			if ("keys" in v && Array.isArray(v.keys)) {
				v.keys = v.keys.map(
					(k: string) => Bytes.parseBytes(k) as BandersnatchKey,
				);
			}

			return v;
		},
	];
	tickets?: TicketBody[];
	keys?: BandersnatchKey[];
}

export class TicketEnvelope {
	static fromJson: FromJson<TicketEnvelope> = {
		attempt: ["number", (v: number) => Bytes.parseBytes(`${v}`) as Bytes<1>],
		signature: ["string", Bytes.parseBytes],
	};

	attempt!: Bytes<1>;
	signature!: Bytes<784>;
}

export class State {
	static fromJson: FromJson<State> = {
		timeslot: "number",
		entropy: ["array", EntropyHashFromJson],
		prev_validators: ["array", ValidatorData.fromJson],
		curr_validators: ["array", ValidatorData.fromJson],
		next_validators: ["array", ValidatorData.fromJson],
		designed_validators: ["array", ValidatorData.fromJson],
		tickets_accumulator: ["array", TicketBody.fromJson],
		tickets_or_keys: TicketsOrKeys.fromJson,
		tickets_verifier_key: ["string", Bytes.parseBytes],
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
		entropy: ["string", (v: string) => Bytes.parseBytes(v) as EntropyHash],
		validators: [
			"array",
			["string", (v: string) => Bytes.parseBytes(v) as BandersnatchKey],
		],
	};

	entropy!: EntropyHash;
	validators!: BandersnatchKey[];
}

export class OkOutput {
	static fromJson = optional<OkOutput>({
		epoch_mark: EpochMark.fromJson,
		tickets_mark: ["array", TicketBody.fromJson],
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
			entropy: ["string", (v: string) => Bytes.parseBytes(v) as EntropyHash],
			extrinsics: ["array", TicketEnvelope.fromJson],
		},
		pre_state: State.fromJson,
		output: Output.fromJson,
		post_state: State.fromJson,
	};

	input!: {
		slot: number;
		entropy: EntropyHash;
		extrinsics: TicketEnvelope[];
	};
	pre_state!: State;
	output!: Output;
	post_state!: State;
}

export function runSafroleTest(t: TestContext, testContent: SafroleTest) {
	console.log(testContent);
	t.todo("implement me");
}
