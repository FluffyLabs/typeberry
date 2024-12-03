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
import { Encoder } from "@typeberry/codec";
import { asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type BlocksDb, InMemoryKvdb } from "@typeberry/database";
import { HASH_SIZE, SimpleAllocator } from "@typeberry/hash";
import { TransitionHasher } from "@typeberry/transition";
import { asOpaqueType } from "@typeberry/utils";

export class Generator {
  public readonly database = new InMemoryKvdb();
  private readonly hashAllocator = new SimpleAllocator();
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header | null;

  constructor(
    public readonly chainSpec: ChainSpec,
    blocks: BlocksDb,
  ) {
    this.lastHeaderHash = blocks.getBestHeaderHash();
    this.lastHeader = blocks.getHeader(this.lastHeaderHash)?.materialize() ?? null;
  }

  async nextEncodedBlock() {
    const newBlock = await this.nextBlock();
    const encoded = Encoder.encodeObject(Block.Codec, newBlock, this.chainSpec);
    return encoded;
  }

  async nextBlock() {
    const lastTimeSlot = this.lastHeader?.timeSlotIndex;
    const blockNumber = lastTimeSlot ? lastTimeSlot + 1 : 1;

    const hasher = new TransitionHasher(this.chainSpec, this.hashAllocator);
    // TODO [ToDr] write benchmark to calculate many hashes.
    const parentHeaderHash = this.lastHeaderHash;
    const stateRoot = await this.database.getRoot();

    const extrinsic = new Extrinsic(
      asOpaqueType([]),
      [new Preimage(tryAsServiceId(1), BytesBlob.parseBlob("0x1234"))],
      asOpaqueType([]),
      asOpaqueType([]),
      new DisputesExtrinsic(
        [
          new Verdict(
            Bytes.fill(HASH_SIZE, blockNumber % 256).asOpaque(),
            tryAsEpoch(blockNumber / this.chainSpec.epochLength),
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
      timeSlotIndex: tryAsTimeSlot(blockNumber),
      epochMarker: null,
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: tryAsValidatorIndex(0),
      entropySource: Bytes.fill(96, (blockNumber * 42) % 256).asOpaque(),
      seal: Bytes.fill(96, (blockNumber * 69) % 256).asOpaque(),
    });

    this.lastHeaderHash = hasher.header(header).hash;
    this.lastHeader = header;
    return new Block(header, extrinsic);
  }
}
