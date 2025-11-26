import {
  Block,
  type EntropyHash,
  encodeUnsealedHeader,
  Header,
  type HeaderHash,
  tryAsTimeSlot,
  type ValidatorIndex,
} from "@typeberry/block";
import { type BlockView, Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import {
  BANDERSNATCH_VRF_SIGNATURE_BYTES,
  type BandersnatchSecretSeed,
  type BandersnatchVrfSignature,
} from "@typeberry/crypto";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { type Blake2b, HASH_SIZE, type keccak } from "@typeberry/hash";
import type { U64 } from "@typeberry/numbers";
import { Safrole } from "@typeberry/safrole";
import bandersnatchVrf from "@typeberry/safrole/bandersnatch-vrf.js";
import type { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { JAM_ENTROPY } from "@typeberry/safrole/constants.js";
import type { State } from "@typeberry/state";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType, Result } from "@typeberry/utils";

const EMPTY_AUX_DATA = BytesBlob.empty();
export class Generator {
  private lastHeaderHash: HeaderHash;
  private lastState: State;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly bandersnatch: Promise<BandernsatchWasm>,
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
    sealPayload: BytesBlob,
    time: U64,
  ): Promise<BlockView> {
    const newBlock = await this.nextBlock(validatorIndex, bandersnatchSecret, sealPayload, time);
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    const view = Decoder.decodeObject(Block.Codec.View, encoded, this.chainSpec);
    return view;
  }

  private async getEntropySource(
    sealPayload: BytesBlob,
    bandersnatchSecret: BandersnatchSecretSeed,
  ): Promise<Result<BandersnatchVrfSignature, null>> {
    const entropyHashResult = await bandersnatchVrf.generateSeal(
      await this.bandersnatch,
      bandersnatchSecret,
      sealPayload,
      EMPTY_AUX_DATA,
    );

    if (entropyHashResult.isError) {
      return Result.error(null, () => "Entropy hash generation failed");
    }

    const entropyHash: EntropyHash = Bytes.fromBlob(
      entropyHashResult.ok.raw.subarray(0, HASH_SIZE),
      HASH_SIZE,
    ).asOpaque();
    const entropySourcePayload = BytesBlob.blobFromParts(JAM_ENTROPY, entropyHash.raw);

    return bandersnatchVrf.generateSeal(
      await this.bandersnatch,
      bandersnatchSecret,
      entropySourcePayload,
      EMPTY_AUX_DATA,
    );
  }

  async nextBlock(
    validatorIndex: ValidatorIndex,
    bandersnatchSecret: BandersnatchSecretSeed,
    sealPayload: BytesBlob,
    time: U64,
  ) {
    // fetch latest data from the db.
    this.refreshLastHeaderAndState();

    // incrementing timeslot for current block
    const newTimeSlot = tryAsTimeSlot(Number(time / BigInt(this.chainSpec.slotDuration * 1000)));

    // retriev data from previous block
    const hasher = new TransitionHasher(this.keccakHasher, this.blake2b);
    const parentHeaderHash = this.lastHeaderHash;
    const stateRoot = this.states.getStateRoot(this.lastState);

    // create extrinsic
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

    const encodedExtrinsic = Encoder.encodeObject(Extrinsic.Codec, extrinsic, this.chainSpec);
    const extrinsicView = Decoder.decodeObject(Extrinsic.Codec.View, encodedExtrinsic, this.chainSpec);
    const extrinsicHash = hasher.extrinsic(extrinsicView).hash;

    const entropySourceResult = await this.getEntropySource(sealPayload, bandersnatchSecret);

    if (entropySourceResult.isError) {
      throw new Error(`Entropy source generation failed: ${entropySourceResult.error}`);
    }

    const entropySource = entropySourceResult.ok;

    const entropy: EntropyHash = Bytes.fromBlob(entropySource.raw.subarray(0, HASH_SIZE), HASH_SIZE).asOpaque();
    const state = this.states.getState(parentHeaderHash);

    if (state === null) {
      throw new Error(`Missing state at ${parentHeaderHash}! Make sure DB is initialized.`);
    }

    const slot = tryAsTimeSlot(newTimeSlot);
    const safrole = new Safrole(this.chainSpec, this.blake2b, state);
    const safroleResult = await safrole.blockAuthorshipTransition({
      entropy,
      slot,
      extrinsic: extrinsic.tickets,
      epochMarker: null,
      punishSet: state.disputesRecords.punishSet,
      ticketsMarker: null,
    });

    if (safroleResult.isError) {
      throw new Error(`Safrole transition error: ${safroleResult.error}`);
    }

    // create header
    const header = Header.create({
      parentHeaderHash,
      priorStateRoot: await stateRoot,
      extrinsicHash,
      timeSlotIndex: slot,
      epochMarker: safroleResult.ok.epochMark,
      ticketsMarker: safroleResult.ok.ticketsMark,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: validatorIndex,
      entropySource: entropySource,
      seal: Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES).asOpaque(),
    });
    const encoded = Encoder.encodeObject(Header.Codec, header, this.chainSpec);
    const headerView = Decoder.decodeObject(Header.Codec.View, encoded, this.chainSpec);
    const sealResult = await bandersnatchVrf.generateSeal(
      await this.bandersnatch,
      bandersnatchSecret,
      sealPayload,
      encodeUnsealedHeader(headerView),
    );

    if (sealResult.isError) {
      throw new Error(`Seal generation failed: ${sealResult.error}`);
    }
    // TODO [MaSo] IDK if this is ok to update it here.
    // This function utility is to create a block
    // not to update any logic.
    header.seal = sealResult.ok;
    const encodedWithSeal = Encoder.encodeObject(Header.Codec, header, this.chainSpec);
    const headerViewWithSeal = Decoder.decodeObject(Header.Codec.View, encodedWithSeal, this.chainSpec);
    this.lastHeaderHash = hasher.header(headerViewWithSeal).hash;

    return Block.create({ header, extrinsic });
  }
}
