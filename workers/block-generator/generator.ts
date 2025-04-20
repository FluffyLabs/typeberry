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
import type { State } from "@typeberry/state";
import { merkelizeState, serializeState } from "@typeberry/state-merkleization";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType } from "@typeberry/utils";

export class Generator {
  public readonly state: State;
  private readonly hashAllocator = new SimpleAllocator();
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header;

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly keccakHasher: KeccakHasher,
    blocks: BlocksDb,
    state: StatesDb,
  ) {
    const data = blocks.getBestData();
    this.lastHeaderHash = data[0];
    const lastHeader = blocks.getHeader(this.lastHeaderHash)?.materialize() ?? null;
    const lastState = state.getFullState(data[1]);
    if (lastHeader === null) {
      throw new Error(`Missing best header: ${data[0]}! Make sure DB is initialized.`);
    }
    if (lastState === null) {
      throw new Error(`Missing last state: ${data[1]}! Make sure DB is initialized.`);
    }
    this.lastHeader = lastHeader;
    this.state = lastState;
  }

  async nextEncodedBlock() {
    const newBlock = await this.nextBlock();
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    return encoded;
  }

  async nextBlock() {
    const lastTimeSlot = this.lastHeader.timeSlotIndex;
    // NOTE [ToDr] this is incorrect, should be based on time instead.
    const newTimeSlot = lastTimeSlot + 1;

    const hasher = new TransitionHasher(this.chainSpec, this.keccakHasher, this.hashAllocator);
    const parentHeaderHash = this.lastHeaderHash;
    const stateRoot = merkelizeState(serializeState(this.state, this.chainSpec));

    const extrinsic = new Extrinsic(
      asOpaqueType([]),
      [new Preimage(tryAsServiceId(1), BytesBlob.parseBlob("0x1234"))],
      asOpaqueType([]),
      asOpaqueType([]),
      new DisputesExtrinsic(
        [
          new Verdict(
            Bytes.fill(HASH_SIZE, newTimeSlot % 256).asOpaque(),
            tryAsEpoch(newTimeSlot / this.chainSpec.epochLength),
            asKnownSize([
              new Judgement(true, tryAsValidatorIndex(0), Bytes.fill(64, 0).asOpaque()),
              new Judgement(true, tryAsValidatorIndex(1), Bytes.fill(64, 1).asOpaque()),
              new Judgement(true, tryAsValidatorIndex(2), Bytes.fill(64, 2).asOpaque()),
              new Judgement(true, tryAsValidatorIndex(3), Bytes.fill(64, 3).asOpaque()),
              new Judgement(true, tryAsValidatorIndex(4), Bytes.fill(64, 4).asOpaque()),
            ]),
          ),
        ],
        [],
        [],
      ),
    );
    const extrinsicHash = hasher.extrinsic(extrinsic).hash;

    const header = Header.fromCodec({
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
    return new Block(header, extrinsic);
  }
}
