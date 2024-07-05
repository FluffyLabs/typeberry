import type { TestContext } from "node:test";
import type { Opaque } from "../../packages/opaque";

function assert(value: boolean, description: string): asserts value is true {
	if (!value) throw new Error(description);
}

export class Blob {
	readonly buffer: ArrayBuffer = new ArrayBuffer(0);
	readonly length?: number = 0;
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
}

export type Hash = Bytes<32>;

export type EntropyHash = Opaque<Hash, "entropy">;

export type Ed25519Key = Opaque<Bytes<32>, "ed25519">;
export type BandersnatchKey = Opaque<Bytes<32>, "BandersnatchKey">;
export type BlsKey = Opaque<Bytes<144>, "bls">;

export interface ValidatorData {
	ed25519: Ed25519Key;
	bandersnatch: BandersnatchKey;
	bls: BlsKey;
	metadata: Blob;
}

export type TicketsOrKeys = 0 /* tickets */ | 1 /* keys */;

export interface TicketBody {
	id: Hash;
	attempt: Bytes<1>;
}

export interface TicketEnvelope {
	attempt: Bytes<1>;
	signature: Bytes<784>;
}

export interface SafroleState {
	timeslot: number;
	entropy: [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
	prev_validators: ValidatorData[];
	curr_validators: ValidatorData[];
	next_validators: ValidatorData[];
	designed_validators: ValidatorData[];
	tickets_accumulator: TicketBody[];
	tickets_or_keys: TicketsOrKeys;
	tickets_verifier_key: Bytes<384>;
}

export interface SafroleTest {
	input: {
		slot: number;
		entropy: EntropyHash;
		extrinsics: TicketEnvelope[];
	};
	pre_state: SafroleState;
}

export function isSafroleTest(
	testContent: unknown,
): testContent is SafroleTest {
	// TODO [ToDr] pretty shitty
	if (typeof testContent !== "object" || testContent === null) return false;
	const safroleTest = testContent as SafroleTest;
	return (
		true &&
		typeof safroleTest.input === "object" &&
		typeof safroleTest.input.slot === "number" &&
		typeof safroleTest.pre_state !== "undefined"
	);
}

export function runSafroleTest(t: TestContext, testContent: SafroleTest) {
	t.todo("implement me");
}
