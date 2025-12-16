import {
  Block,
  encodeUnsealedHeader,
  Header,
  type HeaderHash,
  reencodeAsView,
  type TimeSlot,
  type ValidatorIndex,
} from "@typeberry/block";
import { type BlockView, Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES, type BandersnatchSecretSeed } from "@typeberry/crypto";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import type { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { Safrole } from "@typeberry/safrole";
import bandersnatchVrf, { type VrfOutputHash } from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_ENTROPY } from "@typeberry/safrole/constants.js";
import type { State } from "@typeberry/state";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType, type Opaque, Result } from "@typeberry/utils";

const EMPTY_AUX_DATA = BytesBlob.empty();
const logger = Logger.new(import.meta.filename, "author");

/**
 * Either Ticket (Safrole) or Key (fallback) seal input data.
 *
 * Passed to function V, either:
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/0e46010e4601?v=0.7.2
 * or:
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/0eac010eac01?v=0.7.2
 *
 */
export type BlockSealInput = Opaque<BytesBlob, "Seal">;

export class Generator {
  private lastHeaderHash: HeaderHash;
  private lastState: State;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly bandersnatch: BandernsatchWasm,
    public readonly keccakHasher: keccak.KeccakHasher,
    public readonly blake2b: Blake2b,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
  ) {
    const { lastHeaderHash, lastState } = Generator.getLastHeaderAndState(blocks, states);
    this.lastHeaderHash = lastHeaderHash;
    this.lastState = lastState;
  }

  private refreshLastHeaderAndState(): void {
    const { lastHeaderHash, lastState } = Generator.getLastHeaderAndState(this.blocks, this.states);
    this.lastHeaderHash = lastHeaderHash;
    this.lastState = lastState;
  }

  private static getLastHeaderAndState(blocks: BlocksDb, states: StatesDb) {
    const headerHash = blocks.getBestHeaderHash();
    const lastHeader = blocks.getHeader(headerHash)?.materialize() ?? null;
    const lastState = states.getState(headerHash);
    if (lastHeader === null) {
      throw new Error(`Missing best header: ${headerHash}! Make sure DB is initialized.`);
    }
    if (lastState === null) {
      throw new Error(`Missing last state at ${headerHash}! Make sure DB is initialized.`);
    }
    return {
      lastHeaderHash: headerHash,
      lastHeader,
      lastState,
    };
  }

  async nextBlockView(
    validatorIndex: ValidatorIndex,
    bandersnatchSecret: BandersnatchSecretSeed,
    sealPayload: BlockSealInput,
    timeSlot: TimeSlot,
  ): Promise<BlockView> {
    const newBlock = await this.nextBlock(validatorIndex, bandersnatchSecret, sealPayload, timeSlot);
    return reencodeAsView(Block.Codec, newBlock, this.chainSpec);
  }

  /**
   * Returns y(H_S) part of the VRF signature.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/0ec7010ece01?v=0.7.2
   *
   * Note that in case of Ticket-sealing this is going to be the ticket value.
   *
   * In either case (Tickets or Keys) the value returned here DOES not depend on the header
   * data (i.e. the `aux_data`) so we are able to compute it beforehand.
   */
  private async getEntropyHash(
    sealPayload: BytesBlob,
    bandersnatchSecret: BandersnatchSecretSeed,
  ): Promise<Result<VrfOutputHash, null>> {
    const entropyHashResult = await bandersnatchVrf.getVrfOutputHash(
      this.bandersnatch,
      bandersnatchSecret,
      sealPayload,
    );

    if (entropyHashResult.isError) {
      return Result.error(null, () => "Entropy hash generation failed");
    }

    return entropyHashResult;
  }

  async nextBlock(
    validatorIndex: ValidatorIndex,
    bandersnatchSecret: BandersnatchSecretSeed,
    sealPayload: BlockSealInput,
    timeSlot: TimeSlot,
  ) {
    // fetch latest data from the db.
    this.refreshLastHeaderAndState();

    // generate entropy hash first (NOTE this might be coming from a ticket)
    const entropyHashRes = await this.getEntropyHash(sealPayload, bandersnatchSecret);
    if (entropyHashRes.isError) {
      throw new Error(`Entropy hash generation failed: ${entropyHashRes.error}`);
    }
    const entropyHash = entropyHashRes.ok;
    logger.trace`Generated entropy: ${entropyHash} for block @${timeSlot}`;

    // create the signature for source of entropy
    const entropySource = await bandersnatchVrf.generateSeal(
      this.bandersnatch,
      bandersnatchSecret,
      BytesBlob.blobFromParts([JAM_ENTROPY, entropyHash.raw]),
      EMPTY_AUX_DATA,
    );
    if (entropySource.isError) {
      throw new Error(`Entropy source generation failed: ${entropySource.error}`);
    }

    // retriev data from previous block
    const hasher = new TransitionHasher(this.keccakHasher, this.blake2b);
    const parentHeaderHash = this.lastHeaderHash;
    const stateRoot = this.states.getStateRoot(this.lastState);

    // TODO create extrinsic
    const extrinsic = Extrinsic.create({
      tickets: asOpaqueType([]),
      preimages: [],
      guarantees: asOpaqueType([]),
      assurances: asOpaqueType([]),
      disputes: DisputesExtrinsic.create({
        verdicts: [],
        culprits: [],
        faults: [],
      }),
    });

    const extrinsicView = reencodeAsView(Extrinsic.Codec, extrinsic, this.chainSpec);
    const extrinsicHash = hasher.extrinsic(extrinsicView).hash;

    const state = this.states.getState(parentHeaderHash);

    if (state === null) {
      throw new Error(`Missing state at ${parentHeaderHash}! Make sure DB is initialized.`);
    }

    const safrole = new Safrole(this.chainSpec, this.blake2b, state);
    const safroleResult = await safrole.blockAuthorshipTransition({
      entropy: entropyHash.asOpaque(),
      slot: timeSlot,
      extrinsic: extrinsic.tickets,
      punishSet: state.disputesRecords.punishSet,
    });

    if (safroleResult.isError) {
      throw new Error(`Safrole transition error: ${safroleResult.error}`);
    }

    // create header
    const headerData = {
      parentHeaderHash,
      priorStateRoot: await stateRoot,
      extrinsicHash,
      timeSlotIndex: timeSlot,
      epochMarker: safroleResult.ok.epochMark,
      ticketsMarker: safroleResult.ok.ticketsMark,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: validatorIndex,
      entropySource: entropySource.ok,
    };

    const unsealedHeader = Header.create({
      ...headerData,
      seal: Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque(),
    });

    const sealResult = await bandersnatchVrf.generateSeal(
      this.bandersnatch,
      bandersnatchSecret,
      sealPayload,
      encodeUnsealedHeader(reencodeAsView(Header.Codec, unsealedHeader, this.chainSpec)),
    );

    if (sealResult.isError) {
      throw new Error(`Seal generation failed: ${sealResult.error}`);
    }
    const header = Header.create({
      ...headerData,
      seal: sealResult.ok,
    });
    const headerViewWithSeal = reencodeAsView(Header.Codec, header, this.chainSpec);
    this.lastHeaderHash = hasher.header(headerViewWithSeal).hash;

    return Block.create({ header, extrinsic });
  }
}
