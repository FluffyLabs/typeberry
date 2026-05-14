import {
  Block,
  type EntropyHash,
  encodeUnsealedHeader,
  Header,
  reencodeAsView,
  type TimeSlot,
  type ValidatorIndex,
} from "@typeberry/block";
import { type BlockView, Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import type { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { HashSet } from "@typeberry/collections/hash-set.js";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES, type BandersnatchSecretSeed } from "@typeberry/crypto";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import type { Blake2b, keccak } from "@typeberry/hash";
import { Logger } from "@typeberry/logger";
import { Safrole } from "@typeberry/safrole";
import bandersnatchVrf, { type VrfOutputHash } from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_ENTROPY } from "@typeberry/safrole/constants.js";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType, now, type Opaque, Result } from "@typeberry/utils";
import * as metrics from "./metrics.js";

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

/** Construction arguments for {@link Generator}. */
export type GeneratorArgs = {
  chainSpec: ChainSpec;
  bandersnatch: BandernsatchWasm;
  keccakHasher: keccak.KeccakHasher;
  blake2b: Blake2b;
  blocks: BlocksDb;
  states: StatesDb;
};

export class Generator {
  private readonly metrics: ReturnType<typeof metrics.createMetrics>;

  public readonly chainSpec: ChainSpec;
  public readonly bandersnatch: BandernsatchWasm;
  public readonly keccakHasher: keccak.KeccakHasher;
  public readonly blake2b: Blake2b;
  private readonly blocks: BlocksDb;
  private readonly states: StatesDb;

  /** Build a {@link Generator} from its collaborators. */
  static new(args: GeneratorArgs) {
    return new Generator(args);
  }

  private constructor(args: GeneratorArgs) {
    this.chainSpec = args.chainSpec;
    this.bandersnatch = args.bandersnatch;
    this.keccakHasher = args.keccakHasher;
    this.blake2b = args.blake2b;
    this.blocks = args.blocks;
    this.states = args.states;
    this.metrics = metrics.createMetrics();
  }

  private getLastHeaderAndState() {
    const headerHash = this.blocks.getBestHeaderHash();
    const lastState = this.states.getState(headerHash);
    if (lastState === null) {
      throw new Error(`Missing last state at ${headerHash}! Make sure DB is initialized.`);
    }
    return {
      lastHeaderHash: headerHash,
      lastState,
    };
  }

  async nextBlockView(
    validatorIndex: ValidatorIndex,
    bandersnatchSecret: BandersnatchSecretSeed,
    sealPayload: BlockSealInput,
    timeSlot: TimeSlot,
    pendingTickets: { ticket: SignedTicket; id: EntropyHash }[] = [],
  ): Promise<BlockView> {
    const newBlock = await this.nextBlock(validatorIndex, bandersnatchSecret, sealPayload, timeSlot, pendingTickets);
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

  /**
   * Selects tickets to include in the extrinsic from the pending pool.
   *
   * Tickets were already verified at receipt time (IDs pre-computed). This method:
   * 1. Filters out tickets whose IDs are already in `state.ticketsAccumulator` (already processed).
   * 2. Sorts remaining tickets by ID ascending (required by Safrole).
   * 3. Deduplicates by ID (pool dedup is best-effort; reorgs can produce duplicates).
   * 4. Returns at most `chainSpec.maxTicketsPerExtrinsic` tickets.
   *
   * Called only during the contest period (slotInEpoch < contestLength).
   */
  private prepareTicketsExtrinsic(
    pendingTickets: { ticket: SignedTicket; id: EntropyHash }[],
    state: ReturnType<Generator["getLastHeaderAndState"]>["lastState"],
  ): SignedTicket[] {
    if (pendingTickets.length === 0) {
      return [];
    }

    // Tickets are already verified at receipt time — just filter, sort and slice.
    // Build a set of ticket IDs already in the state accumulator for fast lookup.
    const accumulatedIds = HashSet.from(state.ticketsAccumulator.map((t) => t.id));

    const filtered = pendingTickets.filter(({ id }) => !accumulatedIds.has(id));

    // Sort by ID ascending
    filtered.sort((a, b) => a.id.compare(b.id).value);

    // Deduplicate by ID (pool dedup is best-effort; state may produce duplicates across reorgs)
    const deduped: typeof filtered = [];
    for (const item of filtered) {
      if (deduped.length === 0 || !deduped[deduped.length - 1].id.isEqualTo(item.id)) {
        deduped.push(item);
      }
    }

    return deduped.slice(0, this.chainSpec.maxTicketsPerExtrinsic).map(({ ticket }) => ticket);
  }

  async nextBlock(
    validatorIndex: ValidatorIndex,
    bandersnatchSecret: BandersnatchSecretSeed,
    sealPayload: BlockSealInput,
    timeSlot: TimeSlot,
    pendingTickets: { ticket: SignedTicket; id: EntropyHash }[] = [],
  ) {
    this.metrics.recordBlockAuthoringStarted(timeSlot);
    const startTime = now();
    // fetch latest data from the db.
    const { lastHeaderHash, lastState } = this.getLastHeaderAndState();

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

    // retrieve data from previous block
    const hasher = TransitionHasher.new(this.keccakHasher, this.blake2b);
    const stateRoot = this.states.getStateRoot(lastState);

    const slotInEpoch = timeSlot % this.chainSpec.epochLength;
    const isContestPeriod = slotInEpoch < this.chainSpec.contestLength;

    // Include tickets only during contest period
    const ticketsForExtrinsic = isContestPeriod ? await this.prepareTicketsExtrinsic(pendingTickets, lastState) : [];

    const extrinsic = Extrinsic.create({
      tickets: asOpaqueType(ticketsForExtrinsic),
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

    const safrole = new Safrole(this.chainSpec, this.blake2b, lastState);
    const safroleResult = await safrole.blockAuthorshipTransition({
      entropy: entropyHash.asOpaque(),
      slot: timeSlot,
      extrinsic: extrinsic.tickets,
      punishSet: lastState.disputesRecords.punishSet,
    });

    if (safroleResult.isError) {
      throw new Error(`Safrole transition error: ${safroleResult.error}`);
    }

    // create header
    const headerData = {
      parentHeaderHash: lastHeaderHash,
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

    const duration = now() - startTime;
    this.metrics.recordBlockAuthored(timeSlot, duration);

    return Block.create({ header, extrinsic });
  }
}
