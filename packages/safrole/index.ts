import type { TicketAttempt, TicketEnvelope } from "@typeberry/block/tickets";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { Opaque } from "@typeberry/utils";
import type { BandersnatchKey, Ed25519Key } from "../block/crypto";
import { verifyBandersnatch } from "./bandersnatch";
import type { BlsKey } from "./crypto";

export type Hash = Bytes<32>;
export type EntropyHash = Opaque<Hash, "EntropyHash">;

export type TicketBody = {
  id: Hash;
  attempt: TicketAttempt;
};

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
  ticketsAccumulator(): TicketBody[];
};

export type StateDiff = {
  timeslot?: number;
  entropy?: [EntropyHash];
  prevValidators?: ValidatorData[];
  currValidators?: ValidatorData[];
  nextValidators?: ValidatorData[];
  designedValidators?: ValidatorData[];
  ticketsAccumulator?: TicketBody[];
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
    extrinsic: TicketEnvelope[];
  }): Promise<StateDiff> {
    const newState: StateDiff = {};
    if (this.state.timeslot() > input.slot) {
      throw new Error(`Timeslot is in the past. Current ${this.state.timeslot()}, got ${input.slot}`);
    }

    await verifyBandersnatch();

    newState.timeslot = input.slot;
    newState.entropy = [input.entropy];
    for (const v of input.extrinsic) {
      // TODO [ToDr] Verify signatures
    }

    return newState;
  }
}
