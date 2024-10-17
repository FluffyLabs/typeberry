import type { BandersnatchKey, Ed25519Key, EntropyHash } from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import type { BytesBlob } from "@typeberry/bytes";
import { verifyBandersnatch } from "./bandersnatch";
import type { BlsKey } from "./crypto";

export type ValidatorData = {
  ed25519: Ed25519Key;
  bandersnatch: BandersnatchKey;
  bls: BlsKey;
  metadata: BytesBlob;
};

export type State = {
  timeslot(): number;
  entropy(): [EntropyHash, EntropyHash, EntropyHash, EntropyHash];
  prevValidators(): ValidatorData[];
  currValidators(): ValidatorData[];
  nextValidators(): ValidatorData[];
  designedValidators(): ValidatorData[];
  ticketsAccumulator(): Ticket[];
};

export type StateDiff = {
  timeslot?: number;
  entropy?: [EntropyHash];
  prevValidators?: ValidatorData[];
  currValidators?: ValidatorData[];
  nextValidators?: ValidatorData[];
  designedValidators?: ValidatorData[];
  ticketsAccumulator?: Ticket[];
};

export class Safrole {
  state: State;

  constructor(state: State) {
    this.state = state;
  }

  async transition(input: {
    slot: number;
    entropy: EntropyHash;
    offenders: Ed25519Key[];
    extrinsic: SignedTicket[];
  }): Promise<StateDiff> {
    const newState: StateDiff = {};
    if (this.state.timeslot() > input.slot) {
      throw new Error(`Timeslot is in the past. Current ${this.state.timeslot()}, got ${input.slot}`);
    }

    await verifyBandersnatch();

    newState.timeslot = input.slot;
    newState.entropy = [input.entropy];
    for (const _v of input.extrinsic) {
      // TODO [ToDr] Verify signatures
    }

    return newState;
  }
}
