import type { BlockView, HeaderHash, TimeSlot } from "@typeberry/block";
import type { BlocksDb } from "@typeberry/database";
import { Result } from "@typeberry/utils";
import type { TransitionHasher } from "./hasher";

export enum BlockVerifierError {
  ParentNotFound = 0,
  InvalidTimeSlot = 1,
  InvalidExtrinsic = 2,
  InvalidStateRoot = 3,
}

export class BlockVerifier {
  constructor(
    public readonly hasher: TransitionHasher,
    private readonly blocks: BlocksDb,
  ) {}

  async verifyBlock(block: BlockView, currentTimeSlot: TimeSlot): Promise<Result<HeaderHash, BlockVerifierError>> {
    const headerView = block.header.view();

    // Check if parent block exists.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c82000c8200?v=0.6.5
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c9d000c9d00?v=0.6.5
    const parentHash = headerView.parentHeaderHash.materialize();
    const parentBlock = await this.blocks.getHeader(parentHash);
    if (parentBlock === null) {
      return Result.error(BlockVerifierError.ParentNotFound, `Parent ${parentHash} not found`);
    }

    // Check if the time slot index is consecutive and not from future.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c02010c0201?v=0.6.5
    const timeslot = headerView.timeSlotIndex.materialize();
    const parentTimeslot = parentBlock.timeSlotIndex.materialize();
    if (timeslot <= parentTimeslot || timeslot > currentTimeSlot) {
      return Result.error(
        BlockVerifierError.InvalidTimeSlot,
        `Invalid time slot index: ${timeslot}, expected > ${parentTimeslot} and <= ${currentTimeSlot}`,
      );
    }

    // Check if extrinsic is valid.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0cba000cba00?v=0.6.5
    const extrinsicHash = headerView.extrinsicHash.materialize();
    const extrinsicMerkleCommitment = this.hasher.extrinsicHash(block.extrinsic.view());
    if (!extrinsicHash.isEqualTo(extrinsicMerkleCommitment.hash)) {
      return Result.error(
        BlockVerifierError.InvalidExtrinsic,
        `Invalid extrinsic hash: ${extrinsicHash}, expected ${extrinsicMerkleCommitment.hash}`,
      );
    }

    // Check if the state root is valid.
    // https://graypaper.fluffylabs.dev/#/cc517d7/0c18010c1801?v=0.6.5
    // const stateRoot = headerView.priorStateRoot.materialize();
    // const posteriorStateRoot = this.blocks.getPosteriorStateRoot(parentHash);
    // if (stateRoot !== posteriorStateRoot) {
    //   return Result.error(BlockVerifierError.InvalidStateRoot, `Invalid state root: ${stateRoot}, expected ${posteriorStateRoot}`);
    // }

    const headerHash = this.hasher.header(headerView);

    return Result.ok(headerHash.hash);
  }
}
