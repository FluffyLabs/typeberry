import type { BlockView, HeaderHash } from "@typeberry/block";
import { Result } from "@typeberry/utils";
import type { TransitionHasher } from "./hasher";

export enum BlockVerifierError {
  Dummy = 0,
}

export class BlockVerifier {
  constructor(public readonly hasher: TransitionHasher) {}

  async verifyBlock(block: BlockView): Promise<Result<HeaderHash, BlockVerifierError>> {
    // TODO [ToDr] verify according to GP:
    // - parent exists,
    // - time slot index consecutive,
    // - seal valid,
    // - state root valid, etc
    const headerView = block.header.view();
    const headerHash = this.hasher.header(headerView);

    return Result.ok(headerHash.hash);
  }
}
