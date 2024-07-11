import type { TestContext } from "node:test";
import type { Opaque } from "../../packages/opaque";
import { Blob, Bytes } from "./bytes";
import { type FromJson, optional, parseFromJson } from "./json-parser";

export type Hash = Bytes<32>;

export type EntropyHash = Opaque<Hash, "entropy">;
const EntropyHashFromJson: FromJson<EntropyHash> = [
	"string",
	(v: string) => Bytes.parseBytes(v, 32) as EntropyHash,
];

export type Ed25519Key = Opaque<Bytes<32>, "ed25519">;
export type BandersnatchKey = Opaque<Bytes<32>, "BandersnatchKey">;
export type BlsKey = Opaque<Bytes<144>, "bls">;

export class ValidatorData {
	static fromJson: FromJson<ValidatorData> = {
		ed25519: ["string", (v: string) => Bytes.parseBytes(v, 32) as Ed25519Key],
		bandersnatch: [
			"string",
			(v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey,
		],
		bls: ["string", (v: string) => Bytes.parseBytes(v, 144) as BlsKey],
		metadata: ["string", Blob.parseBlob],
	};

	ed25519!: Ed25519Key;
	bandersnatch!: BandersnatchKey;
	bls!: BlsKey;
	metadata!: Blob;
}

export class TicketBody {
	static fromJson: FromJson<TicketBody> = {
		id: ["string", (v: string) => Bytes.parseBytes(v, 32)],
		attempt: "number",
	};

	id!: Hash;
	attempt!: number;
}

export class TicketsOrKeys {
	static fromJson = optional<TicketsOrKeys>({
		tickets: ["array", TicketBody.fromJson],
		keys: [
			"array",
			["string", (v: string) => Bytes.parseBytes(v, 32) as BandersnatchKey],
		],
	});
	tickets?: TicketBody[];
	keys?: BandersnatchKey[];
}

export class TicketEnvelope {
	static fromJson: FromJson<TicketEnvelope> = {
		attempt: "number",
		signature: ["string", (v: string) => Bytes.parseBytes(v, 784)],
	};

	attempt!: number;
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
		entropy: EntropyHashFromJson,
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
			entropy: EntropyHashFromJson,
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
