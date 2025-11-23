import type { HeaderHash, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import type { HashSet } from "@typeberry/collections";
import type { Ed25519Key } from "@typeberry/crypto";
import type { SafroleStateUpdate } from "@typeberry/safrole";
import type { AssurancesStateUpdate } from "../assurances.js";
import type { RecentHistoryStateUpdate } from "../recent-history.js";

/** Recently imported blocks. */
export interface HeaderChain {
  /** Check whether given `pastBlock` hash is part of the ancestor chain of `currentBlock` */
  isAncestor(pastBlockSlot: TimeSlot, pastBlock: HeaderHash, currentBlock: HeaderHash): boolean;
}

/**
 * Work Report is presented on-chain within `GuaranteesExtrinsic`
 * and then it's being erasure-codec and assured (i.e. voted available
 * by validators).
 *
 * After enough assurances the work-report is considered available,
 * and the work outputs transform the state of their associated
 * service by virtue of accumulation, covered in section 12.
 * The report may also be timed-out, implying it may be replaced
 * by another report without accumulation.
 *
 * https://graypaper.fluffylabs.dev/#/5f542d7/133d00134200
 */
export type ReportsInput = {
  /**
   * A work-package, is transformed by validators acting as
   * guarantors into its corresponding work-report, which
   * similarly comprises several work outputs and then
   * presented on-chain within the guarantees extrinsic.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/133500133900
   */
  guarantees: GuaranteesExtrinsicView;
  /** Current time slot, excerpted from block header. */
  slot: TimeSlot;
  /** `eta_prime`: New entropy, after potential epoch transition. */
  newEntropy: SafroleStateUpdate["entropy"];
  /** Partial update of recent blocks. (β†, https://graypaper.fluffylabs.dev/#/9a08063/0fd8010fdb01?v=0.6.6) */
  recentBlocksPartialUpdate: RecentHistoryStateUpdate["recentBlocks"];
  /**
   * ρ‡ - Availability assignment resulting from assurances transition
   * https://graypaper.fluffylabs.dev/#/1c979cb/141302144402?v=0.7.1
   */
  assurancesAvailAssignment: AssurancesStateUpdate["availabilityAssignment"];
  /**
   * ψ′O - Ed25519 keys of validators that were proven to judge incorrectly.
   *
   * https://graypaper.fluffylabs.dev/#/1c979cb/134201134201?v=0.7.1
   */
  offenders: HashSet<Ed25519Key>;
};
