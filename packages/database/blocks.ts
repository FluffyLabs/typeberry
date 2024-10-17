import type { Block, Header, HeaderHash, WithHash } from "@typeberry/block";
import { HashDictionary, SortedArray } from "@typeberry/collections";
import type { TransitionHasher } from "../transition";

export class InMemoryBlocks {
  private blockByHash: HashDictionary<HeaderHash, Block> = new HashDictionary();
  private blockByTimeSlot: Map<number, SortedArray<Block>> = new Map();

  constructor(private hasher: TransitionHasher) {}

  // TODO [ToDr] This should only store verified blocks (e.g. we know
  // e.g. that extrinsic hash matches the one in header).
  insert(block: Block): WithHash<HeaderHash, Header> {
    const headerWithHash = this.hasher.header(block.header);
    const timeSlot = block.header.timeSlotIndex;

    // We already know about that block, so do nothing.
    if (this.blockByHash.has(headerWithHash.hash)) {
      return headerWithHash;
    }

    // It's a new block, let's insert.
    this.blockByHash.set(headerWithHash.hash, block);
    const blocksByTimeSlot = this.blockByTimeSlot.get(timeSlot) ?? new SortedArray(blockCmp);
    blocksByTimeSlot.insert(block);
    this.blockByTimeSlot.set(timeSlot, blocksByTimeSlot);

    return headerWithHash;
  }

  get(hash: HeaderHash) {
    return this.blockByHash.get(hash);
  }

  bestBlock(): Block | undefined {
    const max = Math.max(...this.blockByTimeSlot.keys());

    if (max === Number.NEGATIVE_INFINITY) {
      return undefined;
    }

    return this.blockByTimeSlot.get(max)?.slice()[0];
  }
}

const blockCmp = (self: Block, other: Block) => {
  return self.header.bandersnatchBlockAuthorIndex - other.header.bandersnatchBlockAuthorIndex;
};
