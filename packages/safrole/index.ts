import type { Bytes, BytesBlob } from "../bytes";
import type { BandersnatchKey, BlsKey, Ed25519Key } from "../crypto";
import type { EntropyHash, Hash } from "../hash";

export type TicketBody = {
	id: Hash;
	attempt: number;
};

export type ValidatorData = {
	ed25519: Ed25519Key;
	bandersnatch: BandersnatchKey;
	bls: BlsKey;
	metadata: BytesBlob;
};

export type TicketEnvelope = {
	attempt: number;
	signature: Bytes<784>;
};

export type State = {
	timeslot(): number;
	entropy(): [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
	prevValidators(): ValidatorData[];
	currValidators(): ValidatorData[];
	nextValidators(): ValidatorData[];
	designedValidators(): ValidatorData[];
	ticketsAccumulator(): TicketBody[];
};

export class Safrole {
	state: State;

	constructor(state: State) {
		this.state = state;
	}

	transition(input: {
		slot: number;
		entropy: EntropyHash;
		extrinsics: TicketEnvelope[];
	}) {
		throw new Error("Method not implemented.");
	}

	currentState(): unknown {
		throw new Error("Method not implemented.");
	}
}
