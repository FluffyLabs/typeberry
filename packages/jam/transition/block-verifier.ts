import type { BlockView, HeaderHash } from "@typeberry/block";
import type { BlocksDb } from "@typeberry/database";
import { Result } from "@typeberry/utils";
import type { TransitionHasher } from "./hasher";
import {HASH_SIZE} from "@typeberry/hash";
import {Bytes} from "@typeberry/bytes";

export enum BlockVerifierError {
  ParentNotFound = 0,
  InvalidTimeSlot = 1,
  InvalidExtrinsic = 2,
  StateRootNotFound = 3,
  InvalidStateRoot = 4,
  AlreadyImported,
}

const ZERO_HASH: HeaderHash = Bytes.zero(HASH_SIZE).asOpaque();

export class BlockVerifier {
  constructor(
    public readonly hasher: TransitionHasher,
    private readonly blocks: BlocksDb,
  ) {}

  async verifyBlock(block: BlockView): Promise<Result<HeaderHash, BlockVerifierError>> {
    const headerView = block.header.view();
    const headerHash = this.hasher.header(headerView);
    // check if current block is already imported
    if (this.blocks.getHeader(headerHash.hash) !== null) {
      return Result.error(BlockVerifierError.AlreadyImported, `Block ${headerHash.hash} is already imported.`);
    }

    // Check if parent block exists.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c82000c8200?v=0.6.5
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c9d000c9d00?v=0.6.5
    const parentHash = headerView.parentHeaderHash.materialize();
    // importing genesis block
    if (!parentHash.isEqualTo(ZERO_HASH)) {
      const parentBlock = this.blocks.getHeader(parentHash);
      if (parentBlock === null) {
        return Result.error(BlockVerifierError.ParentNotFound, `Parent ${parentHash.toString()} not found`);
      }

      // Check if the time slot index is consecutive and not from future.
      // https://graypaper.fluffylabs.dev/#/cc517d7/0c02010c0201?v=0.6.5
      const timeslot = headerView.timeSlotIndex.materialize();
      const parentTimeslot = parentBlock.timeSlotIndex.materialize();
      if (timeslot <= parentTimeslot) {
        return Result.error(
          BlockVerifierError.InvalidTimeSlot,
          `Invalid time slot index: ${timeslot}, expected > ${parentTimeslot}`,
        );
      }
    }

    // Check if extrinsic is valid.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0cba000cba00?v=0.6.5
    const extrinsicHash = headerView.extrinsicHash.materialize();
    const extrinsicMerkleCommitment = this.hasher.extrinsic(block.extrinsic.view());
    if (!extrinsicHash.isEqualTo(extrinsicMerkleCommitment.hash)) {
      return Result.error(
        BlockVerifierError.InvalidExtrinsic,
        `Invalid extrinsic hash: ${extrinsicHash.toString()}, expected ${extrinsicMerkleCommitment.hash.toString()}`,
      );
    }

    // Check if the state root is valid.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c18010c1801?v=0.6.5
    const stateRoot = headerView.priorStateRoot.materialize();
    const posteriorStateRoot = this.blocks.getPostStateRoot(parentHash);
    if (posteriorStateRoot === null) {
      return Result.error(
        BlockVerifierError.StateRootNotFound,
        `Posterior state root ${parentHash.toString()} not found`,
      );
    }
    if (!stateRoot.isEqualTo(posteriorStateRoot)) {
      return Result.error(
        BlockVerifierError.InvalidStateRoot,
        `Invalid state root: ${stateRoot.toString()}, expected ${posteriorStateRoot.toString()}`,
      );
    }

    return Result.ok(headerHash.hash);
  }

  hashHeader(block: BlockView) {
    return this.hasher.header(block.header.view());
  }
}
