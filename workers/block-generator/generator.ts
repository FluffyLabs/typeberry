import {
  type BandersnatchVrfSignature,
  Block,
  type Ed25519Signature,
  type Epoch,
  HASH_SIZE,
  Header,
  type HeaderHash,
  type ServiceId,
  type TimeSlot,
  type ValidatorIndex,
  type WorkReportHash,
} from "@typeberry/block";
import type { AssurancesExtrinsic, AvailabilityAssurance } from "@typeberry/block/assurances";
import { Extrinsic } from "@typeberry/block/block";
import { type Culprit, DisputesExtrinsic, type Fault, Judgement, Verdict } from "@typeberry/block/disputes";
import type { GuaranteesExtrinsic, ReportGuarantee } from "@typeberry/block/gaurantees";
import { Preimage } from "@typeberry/block/preimage";
import type { SignedTicket, TicketsExtrinsic } from "@typeberry/block/tickets";
import { Bytes, BytesBlob } from "@typeberry/bytes";
import { Encoder } from "@typeberry/codec";
import type { KnownSizeArray } from "@typeberry/collections";
import { SimpleAllocator } from "@typeberry/hash";
import { BlocksDb, InMemoryKvdb } from "@typeberry/database";
import { TransitionHasher } from "@typeberry/transition";
import {ChainSpec} from "@typeberry/config";

export class Generator {
  public readonly database = new InMemoryKvdb();
  private readonly hashAllocator = new SimpleAllocator();
  private lastHeaderHash: HeaderHash;
  private lastHeader: Header | null;

  constructor(
    public readonly chainSpec: ChainSpec,
    private readonly blocks: BlocksDb,
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
      [] as SignedTicket[] as TicketsExtrinsic,
      new DisputesExtrinsic(
        [
          new Verdict(
            Bytes.fill(HASH_SIZE, blockNumber % 256) as WorkReportHash,
            (blockNumber / this.chainSpec.epochLength) as Epoch,
            [
              new Judgement(true, 0 as ValidatorIndex, Bytes.fill(64, 0) as Ed25519Signature),
              new Judgement(true, 1 as ValidatorIndex, Bytes.fill(64, 1) as Ed25519Signature),
              new Judgement(true, 2 as ValidatorIndex, Bytes.fill(64, 2) as Ed25519Signature),
              new Judgement(true, 3 as ValidatorIndex, Bytes.fill(64, 3) as Ed25519Signature),
              new Judgement(true, 4 as ValidatorIndex, Bytes.fill(64, 4) as Ed25519Signature),
            ] as KnownSizeArray<Judgement, "Validators super majority">,
          ),
        ],
        [] as Culprit[],
        [] as Fault[],
      ),
      [new Preimage(1 as ServiceId, BytesBlob.parseBlob("0x1234"))],
      [] as AvailabilityAssurance[] as AssurancesExtrinsic,
      [] as ReportGuarantee[] as GuaranteesExtrinsic,
    );
    const extrinsicHash = hasher.extrinsic(extrinsic).hash;

    const header = Header.fromCodec({
      parentHeaderHash,
      priorStateRoot: stateRoot,
      extrinsicHash,
      timeSlotIndex: blockNumber as TimeSlot,
      epochMarker: null,
      ticketsMarker: null,
      offendersMarker: [],
      bandersnatchBlockAuthorIndex: 0 as ValidatorIndex,
      entropySource: Bytes.fill(96, (blockNumber * 42) % 256) as BandersnatchVrfSignature,
      seal: Bytes.fill(96, (blockNumber * 69) % 256) as BandersnatchVrfSignature,
    });

    this.lastHeaderHash = hasher.header(header).hash;
    this.lastHeader = header;
    return new Block(header, extrinsic);
  }
}
