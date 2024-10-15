import type { Block, HeaderHash } from "@typeberry/block";
import { HashDictionary, SortedArray } from "@typeberry/collections";
import type { TransitionHasher } from "../transition";

export class InMemoryBlocks {
  private blockByHash: HashDictionary<HeaderHash, Block> = new HashDictionary();
  private blockByTimeSlot: Map<number, SortedArray<Block>> = new Map();

  constructor(private hasher: TransitionHasher) {}

  // TODO [ToDr] This should only store verified blocks (e.g. we know
  // e.g. that extrinsic hash matches the one in header).
  public insert(block: Block) {
    const headerHash = this.hasher.header(block.header);
    const timeSlot = block.header.timeSlotIndex;

    // We already know about that block, so do nothing.
    if (this.blockByHash.has(headerHash)) {
      return;
    }

    // It's a new block, let's insert.
    this.blockByHash.set(headerHash, block);
    const blocksByTimeSlot = this.blockByTimeSlot.get(timeSlot) ?? new SortedArray(blockCmp);
    blocksByTimeSlot.insert(block);
    this.blockByTimeSlot.set(timeSlot, blocksByTimeSlot);
  }

  public get(hash: HeaderHash) {
    return this.blockByHash.get(hash);
  }

  public bestBlock(): Block | undefined {
    let max = null as number | null;
    for (const k of this.blockByTimeSlot.keys()) {
      max = Math.max(max ?? k, k);
    }

    if (max === null) {
      return undefined;
    }

    return this.blockByTimeSlot.get(max)?.slice()[0];
  }
}

const blockCmp = (self: Block, other: Block) => {
  return self.header.bandersnatchBlockAuthorIndex - other.header.bandersnatchBlockAuthorIndex;
};
