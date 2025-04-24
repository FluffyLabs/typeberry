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
    // https://github.com/FluffyLabs/typeberry/issues/316#issue-2966031139
    // - parent exists (https://graypaper.fluffylabs.dev/#/68eaa1f/0c9d000c9d00?v=0.6.4)
    // - time slot index consecutive (https://graypaper.fluffylabs.dev/#/68eaa1f/0c02010c0201?v=0.6.4)
    // - seal valid?
    // - state root valid (https://graypaper.fluffylabs.dev/#/68eaa1f/0c18010c1801?v=0.6.4)
    // - etc
    const headerView = block.header.view();
    const headerHash = this.hasher.header(headerView);

    return Result.ok(headerHash.hash);
  }
}
