import type { Ed25519Key, EntropyHash, ValidatorData } from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import { verifyBandersnatch } from "./bandersnatch";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

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
