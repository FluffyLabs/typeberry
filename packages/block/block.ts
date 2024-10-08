import { type CodecRecord, codec } from "@typeberry/codec";
import { type AssurancesExtrinsic, assurancesExtrinsicCodec } from "./assurances";
import { DisputesExtrinsic } from "./disputes";
import { type GuaranteesExtrinsic, guaranteesExtrinsicCodec } from "./gaurantees";
import { Header } from "./header";
import { type PreimagesExtrinsic, preimagesExtrinsicCodec } from "./preimage";
import { type TicketsExtrinsic, ticketsExtrinsicCodec } from "./tickets";

export class Extrinsic {
  static Codec = codec.Class(Extrinsic, {
    tickets: ticketsExtrinsicCodec,
    disputes: DisputesExtrinsic.Codec,
    preimages: preimagesExtrinsicCodec,
    assurances: assurancesExtrinsicCodec,
    guarantees: guaranteesExtrinsicCodec,
  });

  static fromCodec({ tickets, disputes, preimages, assurances, guarantees }: CodecRecord<Extrinsic>) {
    return new Extrinsic(tickets, disputes, preimages, assurances, guarantees);
  }

  constructor(
    public readonly tickets: TicketsExtrinsic,
    public readonly disputes: DisputesExtrinsic,
    public readonly preimages: PreimagesExtrinsic,
    public readonly assurances: AssurancesExtrinsic,
    public readonly guarantees: GuaranteesExtrinsic,
  ) {}
}

export class Block {
  static Codec = codec.Class(Block, {
    header: Header.Codec,
    extrinsic: Extrinsic.Codec,
  });

  static fromCodec({ header, extrinsic }: CodecRecord<Block>) {
    return new Block(header, extrinsic);
  }

  constructor(
    public readonly header: Header,
    public readonly extrinsic: Extrinsic,
  ) {}
}
