import type { BlockView, EntropyHash, HeaderHash } from "@typeberry/block";
import { Bytes } from "@typeberry/bytes";
import { HASH_SIZE } from "@typeberry/hash";
import { Result } from "@typeberry/utils";
import type { TransitionHasher } from "./hasher";

export enum BlockVerifierError {}

export type Output = {
  headerHash: HeaderHash;
  entropy: EntropyHash;
};

export class BlockVerifier {
  constructor(public readonly hasher: TransitionHasher) {}

  verifyBlock(block: BlockView): Result<Output, Error> {
    // TODO [ToDr] verify according to GP:
    // - parent exists,
    // - time slot index consecutive,
    // - seal valid,
    // - state root valid, etc
    const headerHash = this.hasher.header(block.header.view());

    return Result.ok({
      headerHash: headerHash.hash,
      entropy: Bytes.zero(HASH_SIZE).asOpaque(),
    });
  }
}
