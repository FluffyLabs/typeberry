import { type CodecRecord, type ViewType, codec } from "@typeberry/codec";
import { WithDebug } from "@typeberry/utils";
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
export class Extrinsic extends WithDebug {
  static Codec = codec.Class(Extrinsic, {
    tickets: ticketsExtrinsicCodec,
    preimages: preimagesExtrinsicCodec,
    guarantees: guaranteesExtrinsicCodec,
    assurances: assurancesExtrinsicCodec,
    disputes: DisputesExtrinsic.Codec,
  });

  static fromCodec({ tickets, preimages, assurances, disputes, guarantees }: CodecRecord<Extrinsic>) {
    return new Extrinsic(tickets, preimages, guarantees, assurances, disputes);
  }

  constructor(
    /**
     * `E_T`: Tickets, used for the mechanism which manages the selection of
     *        validators for the permissioning of block authoring.
     */
    public readonly tickets: TicketsExtrinsic,
    /**
     * `E_P`: Static data which is presently being requested to be available for
     *        workloads to be able to fetch on demand.
     */
    public readonly preimages: PreimagesExtrinsic,
    /**
     * `E_G`: Reports of newly completed workloads whose accuracy is guaranteed
     *        by specific validators.
     */
    public readonly guarantees: GuaranteesExtrinsic,
    /**
     * `E_A`: Assurances by each validator concerning which of the input data of
     *        workloads they have correctly received and are storing locally.
     */
    public readonly assurances: AssurancesExtrinsic,
    /**
     * `E_D`: Votes, by validators, on dispute(s) arising between them presently
     *        taking place.
     */
    public readonly disputes: DisputesExtrinsic,
  ) {
    super();
  }
}

/** Undecoded View of an [`Extrinsic`]. */
export type ExtrinsicView = ViewType<typeof Extrinsic.Codec.View>;

/**
 * The block consists of the header and some external input data (extrinsic).
 *
 * `B = (H, E)`
 * https://graypaper.fluffylabs.dev/#/c71229b/089900089900
 */
export class Block extends WithDebug {
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
  ) {
    super();
  }
}

/** Undecoded View of a [`Block`]. */
export type BlockView = ViewType<typeof Block.Codec.View>;
