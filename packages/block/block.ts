import { type CodecRecord, codec } from "@typeberry/codec";
import { type AssurancesExtrinsic, assurancesExtrinsicCodec } from "./assurances";
import { DisputesExtrinsic } from "./disputes";
import { type GuaranteesExtrinsic, guaranteesExtrinsicCodec } from "./gaurantees";
import { Header } from "./header";
import { type PreimagesExtrinsic, preimagesExtrinsicCodec } from "./preimage";
import { type TicketsExtrinsic, ticketsExtrinsicCodec } from "./tickets";

/**
 * Extrinsic part of the block - the input data being external to the system.
 *
 * `E = (E_T, E_D, E_P, E_A, E_G)`
 *
 * https://graypaper.fluffylabs.dev/#/c71229b/08ab0008ab00
 */
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
    /**
     * `E_T`: Tickets, used for the mechanism which manages the selection of
     *        validators for the permissioning of block authoring.
     */
    public readonly tickets: TicketsExtrinsic,
    /**
     * `E_D`: Votes, by validators, on dispute(s) arising between them presently
     *        taking place.
     */
    public readonly disputes: DisputesExtrinsic,
    /**
     * `E_P`: Static data which is presently being requested to be available for
     *        workloads to be able to fetch on demand.
     */
    public readonly preimages: PreimagesExtrinsic,
    /**
     * `E_A`: Assurances by each validator concerning which of the input data of
     *        workloads they have correctly received and are storing locally.
     */
    public readonly assurances: AssurancesExtrinsic,
    /**
     * `E_G`: Reports of newly completed workloads whose accuracy is guaranteed
     *        by specific validators.
     */
    public readonly guarantees: GuaranteesExtrinsic,
  ) {}
}

/**
 * The block consists of the header and some external input data (extrinsic).
 *
 * `B = (H, E)`
 * https://graypaper.fluffylabs.dev/#/c71229b/089900089900
 */
export class Block {
  static Codec = codec.Class(Block, {
    header: Header.Codec,
    extrinsic: Extrinsic.Codec,
  });

  static fromCodec({ header, extrinsic }: CodecRecord<Block>) {
    return new Block(header, extrinsic);
  }

  constructor(
    /** `H`: Block header. */
    public readonly header: Header,
    /** `E`: Extrinsic data. */
    public readonly extrinsic: Extrinsic,
  ) {}
}
