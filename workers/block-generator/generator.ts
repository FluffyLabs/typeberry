import { Block, Header, type HeaderHash, tryAsTimeSlot, tryAsValidatorIndex } from "@typeberry/block";
import { Extrinsic } from "@typeberry/block/block.js";
import { DisputesExtrinsic } from "@typeberry/block/disputes.js";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { SimpleAllocator } from "@typeberry/hash";
import type { KeccakHasher } from "@typeberry/hash/keccak.js";
import type { State } from "@typeberry/state";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType } from "@typeberry/utils";

export class Generator {
  private readonly hashAllocator = new SimpleAllocator();
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header;
  private lastState: State;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly keccakHasher: KeccakHasher,
    private readonly blocks: BlocksDb,
    private readonly states: StatesDb,
  ) {
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

  async nextEncodedBlock(): Promise<BytesBlob> {
    const newBlock = await this.nextBlock();
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    return encoded;
  }

  async nextBlock() {
    // fetch latest data from the db.
    this.refreshLastHeaderAndState();

    // incrementing timeslot for current block
    const lastTimeSlot = this.lastHeader.timeSlotIndex;
    const newTimeSlot = lastTimeSlot + 1;

    // select validator for block
    const validatorId = tryAsValidatorIndex(newTimeSlot % 6);

    // retriev data from previous block
    const hasher = new TransitionHasher(this.chainSpec, this.keccakHasher, this.hashAllocator);
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
    const e = Encoder.create();
    e.i32(newTimeSlot);
    e.i16(validatorId);
    e.bytes(Bytes.fill(90, 0));
    const seal = Bytes.fromBlob(e.viewResult().raw, 96);

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
      entropySource: Bytes.fill(96, (newTimeSlot * 42) % 256).asOpaque(),
      seal: seal.asOpaque(),
    });

    // TODO [MaSo] IDK if this is ok to update it here.
    // This function utility is to create a block
    // not to update any logic.
    const encoded = Encoder.encodeObject(Header.Codec, header, this.chainSpec);
    const headerView = Decoder.decodeObject(Header.Codec.View, encoded, this.chainSpec);
    this.lastHeaderHash = hasher.header(headerView).hash;
    this.lastHeader = header;

    return Block.create({ header, extrinsic });
  }
}
