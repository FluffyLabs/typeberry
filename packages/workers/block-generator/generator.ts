import { Block, Header, type HeaderHash, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import { type BlockView, Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { Bytes } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_VRF_SIGNATURE_BYTES } from "@typeberry/crypto";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import type { Blake2b, keccak } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType, now } from "@typeberry/utils";
import * as metrics from "./metrics.js";

export class Generator {
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header;
  private lastState: State;
  private readonly metrics: ReturnType<typeof metrics.createMetrics>;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly keccakHasher: keccak.KeccakHasher,
    public readonly blake2b: Blake2b,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
  ) {
    this.metrics = metrics.createMetrics();
    const { lastHeaderHash, lastHeader, lastState } = Generator.getLastHeaderAndState(blocks, states);
    this.lastHeaderHash = lastHeaderHash;
    this.lastHeader = lastHeader;
    this.lastState = lastState;
  }

  private refreshLastHeaderAndState(): void {
    const { lastHeaderHash, lastHeader, lastState } = Generator.getLastHeaderAndState(this.blocks, this.states);
    this.lastHeaderHash = lastHeaderHash;
    this.lastHeader = lastHeader;
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

  async nextBlockView(): Promise<BlockView> {
    const newBlock = await this.nextBlock();
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    const view = Decoder.decodeObject(Block.Codec.View, encoded, this.chainSpec);
    return view;
  }

  async nextBlock() {
    // fetch latest data from the db.
    this.refreshLastHeaderAndState();

    // incrementing timeslot for current block
    const lastTimeSlot = this.lastHeader.timeSlotIndex;
    const newTimeSlot = lastTimeSlot + 1;

    const startTime = now();
    this.metrics.recordBlockAuthoringStarted(newTimeSlot);

    // select validator for block
    const validatorId = tryAsValidatorIndex(newTimeSlot % 6);

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

    // Create seal
    const seal = Bytes.zero(BANDERSNATCH_VRF_SIGNATURE_BYTES);
    const e = Encoder.create({
      destination: seal.raw,
    });
    e.i32(newTimeSlot);
    e.i16(validatorId);

    // create header
    const header = Header.create({
      parentHeaderHash,
      priorStateRoot: await stateRoot,
      extrinsicHash,
      timeSlotIndex: tryAsTimeSlot(newTimeSlot),
      epochMarker: null,
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: validatorId,
      entropySource: Bytes.fill(BANDERSNATCH_VRF_SIGNATURE_BYTES, (newTimeSlot * 42) % 256).asOpaque(),
      seal: seal.asOpaque(),
    });

    // TODO [MaSo] IDK if this is ok to update it here.
    // This function utility is to create a block
    // not to update any logic.
    const encoded = Encoder.encodeObject(Header.Codec, header, this.chainSpec);
    const headerView = Decoder.decodeObject(Header.Codec.View, encoded, this.chainSpec);
    this.lastHeaderHash = hasher.header(headerView).hash;
    this.lastHeader = header;

    const duration = now() - startTime;
    this.metrics.recordBlockAuthored(newTimeSlot, duration);

    return Block.create({ header, extrinsic });
  }
}
