import {
  BANDERSNATCH_KEY_BYTES,
  type BandersnatchKey,
  ED25519_KEY_BYTES,
  type Ed25519Key,
  type EntropyHash,
} from "@typeberry/block";
import type { SignedTicket, Ticket } from "@typeberry/block/tickets";
import type { Bytes } from "@typeberry/bytes";
import { type CodecRecord, codec } from "@typeberry/codec";
import { WithDebug } from "@typeberry/utils";
import { verifyBandersnatch } from "./bandersnatch";
import { BLS_KEY_BYTES, type BlsKey } from "./crypto";

export const VALIDATOR_META_BYTES = 128;
export type VALIDATOR_META_BYTES = typeof VALIDATOR_META_BYTES;

export class ValidatorData extends WithDebug {
  static Codec = codec.Class(ValidatorData, {
    ed25519: codec.bytes(ED25519_KEY_BYTES).cast(),
    bandersnatch: codec.bytes(BANDERSNATCH_KEY_BYTES).cast(),
    bls: codec.bytes(BLS_KEY_BYTES).cast(),
    metadata: codec.bytes(VALIDATOR_META_BYTES),
  });

  static fromCodec({ ed25519, bandersnatch, bls, metadata }: CodecRecord<ValidatorData>) {
    return new ValidatorData(ed25519, bandersnatch, bls, metadata);
  }

  constructor(
    public readonly ed25519: Ed25519Key,
    public readonly bandersnatch: BandersnatchKey,
    public readonly bls: BlsKey,
    public readonly metadata: Bytes<VALIDATOR_META_BYTES>,
  ) {
    super();
  }
}

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
