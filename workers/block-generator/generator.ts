import {
  Block,
  Header,
  type HeaderHash,
  tryAsEpoch,
  tryAsServiceId,
  tryAsTimeSlot,
  tryAsValidatorIndex,
} from "@typeberry/block";
import { Extrinsic } from "@typeberry/block/block";
import { DisputesExtrinsic, Judgement, Verdict } from "@typeberry/block/disputes";
import { Preimage } from "@typeberry/block/preimage";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { BlocksDb, StatesDb } from "@typeberry/database";
import { HASH_SIZE, SimpleAllocator } from "@typeberry/hash";
import type { KeccakHasher } from "@typeberry/hash/keccak";
import type { InMemoryState } from "@typeberry/state";
import { merkelizeState, serializeInMemoryState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType } from "@typeberry/utils";

export class Generator {
  private readonly hashAllocator = new SimpleAllocator();
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header;
  private lastState: InMemoryState;

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

  private refreshLastHeaderAndState() {
    const { lastHeaderHash, lastHeader, lastState } = Generator.getLastHeaderAndState(this.blocks, this.states);
    this.lastHeaderHash = lastHeaderHash;
    this.lastHeader = lastHeader;
    this.lastState = lastState;
  }

  private static getLastHeaderAndState(blocks: BlocksDb, states: StatesDb) {
    const [headerHash, stateRoot] = blocks.getBestData();
    const lastHeader = blocks.getHeader(headerHash)?.materialize() ?? null;
    const lastState = states.getFullState(stateRoot);
    if (lastHeader === null) {
      throw new Error(`Missing best header: ${headerHash}! Make sure DB is initialized.`);
    }
    if (lastState === null) {
      throw new Error(`Missing last state: ${stateRoot}! Make sure DB is initialized.`);
    }
    return {
      lastHeaderHash: headerHash,
      lastHeader,
      lastState,
    };
  }

  async nextEncodedBlock() {
    const newBlock = await this.nextBlock();
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    return encoded;
  }

  // NOTE [ToDr] this whole function is incorrect, it's just a placeholder for proper generator.
  async nextBlock() {
    // fetch latest data from the db.
    this.refreshLastHeaderAndState();

    const lastTimeSlot = this.lastHeader.timeSlotIndex;
    const newTimeSlot = lastTimeSlot + 1;

    const hasher = new TransitionHasher(this.chainSpec, this.keccakHasher, this.hashAllocator);
    const parentHeaderHash = this.lastHeaderHash;
    const stateRoot = merkelizeState(serializeInMemoryState(this.lastState, this.chainSpec));

    const extrinsic = Extrinsic.create({
      tickets: asOpaqueType([]),
      preimages: [Preimage.create({ requester: tryAsServiceId(1), blob: BytesBlob.parseBlob("0x1234") })],
      guarantees: asOpaqueType([]),
      assurances: asOpaqueType([]),
      disputes: DisputesExtrinsic.create({
        verdicts: [
          Verdict.create({
            workReportHash: Bytes.fill(HASH_SIZE, newTimeSlot % 256).asOpaque(),
            votesEpoch: tryAsEpoch(newTimeSlot / this.chainSpec.epochLength),
            votes: asKnownSize([
              Judgement.create({
                isWorkReportValid: true,
                index: tryAsValidatorIndex(0),
                signature: Bytes.fill(64, 0).asOpaque(),
              }),
              Judgement.create({
                isWorkReportValid: true,
                index: tryAsValidatorIndex(1),
                signature: Bytes.fill(64, 1).asOpaque(),
              }),
              Judgement.create({
                isWorkReportValid: true,
                index: tryAsValidatorIndex(2),
                signature: Bytes.fill(64, 2).asOpaque(),
              }),
              Judgement.create({
                isWorkReportValid: true,
                index: tryAsValidatorIndex(3),
                signature: Bytes.fill(64, 3).asOpaque(),
              }),
              Judgement.create({
                isWorkReportValid: true,
                index: tryAsValidatorIndex(4),
                signature: Bytes.fill(64, 4).asOpaque(),
              }),
            ]),
          }),
        ],
        culprits: [],
        faults: [],
      }),
    });

    const encodedExtrinsic = Encoder.encodeObject(Extrinsic.Codec, extrinsic, this.chainSpec);
    const extrinsicView = Decoder.decodeObject(Extrinsic.Codec.View, encodedExtrinsic, this.chainSpec);
    const extrinsicHash = hasher.extrinsic(extrinsicView).hash;

    const header = Header.create({
      parentHeaderHash,
      priorStateRoot: stateRoot,
      extrinsicHash,
      timeSlotIndex: tryAsTimeSlot(newTimeSlot),
      epochMarker: null,
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: tryAsValidatorIndex(0),
      entropySource: Bytes.fill(96, (newTimeSlot * 42) % 256).asOpaque(),
      seal: Bytes.fill(96, (newTimeSlot * 69) % 256).asOpaque(),
    });

    const encoded = Encoder.encodeObject(Header.Codec, header, this.chainSpec);
    const headerView = Decoder.decodeObject(Header.Codec.View, encoded, this.chainSpec);
    this.lastHeaderHash = hasher.header(headerView).hash;
    this.lastHeader = header;
    return Block.create({ header, extrinsic });
  }
}
