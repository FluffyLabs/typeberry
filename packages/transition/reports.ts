import type { Ed25519Key, EntropyHash, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { SegmentRootLookupItem } from "@typeberry/block/work-report";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { DisputesState } from "@typeberry/disputes";
import { Result } from "@typeberry/utils";
import type { AssurancesState } from "./assurances";
import type { AuthorizationState } from "./authorization";
import type { RecentHistoryState } from "./recent-history";

// TODO [ToDr] docs

export type ReportsInput = {
  guarantees: GuaranteesExtrinsicView;
  slot: TimeSlot;
};

export const ENTROPY_ENTRIES = 4;
export type ENTROPY_ENTRIES = typeof ENTROPY_ENTRIES;

export type ReportsState = {
  // TODO [ToDr] This stuff should be shared between different parts of the STF
  // I imagine we can have a `State` type that contains everything
  // and then here we would be just picking a bunch of fields from that full state.
  availabilityAssignment: AssurancesState["availabilityAssignment"];
  currentValidatorData: DisputesState["currentValidatorData"];
  previousValidatorData: DisputesState["previousValidatorData"];
  entropy: FixedSizeArray<EntropyHash, ENTROPY_ENTRIES>;
  offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;
  authPools: AuthorizationState["authPools"];
  recentBlocks: RecentHistoryState["recentBlocks"];
  // TODO [ToDr] type?
  services: unknown[];
};

export type ReportsOutput = {
  // TODO [ToDr] length?
  reported: SegmentRootLookupItem[];
  // TODO [ToDr] length?
  reporters: Ed25519Key[];
};

export enum ReportsError {
  BadCoreIndex = 0,
  FutureReportSlot = 1,
  ReportEpochBeforeLast = 2,
  InsufficientGuarantees = 3,
  OutOfOrderGuarantee = 4,
  NotSortedOrUniqueGuarantors = 5,
  WrongAssignment = 6,
  CoreEngaged = 7,
  AnchorNotRecent = 8,
  BadServiceId = 9,
  BadCodeHash = 10,
  DependencyMissing = 11,
  DuplicatePackage = 12,
  BadStateRoot = 13,
  BadBeefyMmrRoot = 14,
  CoreUnauthorized = 15,
  BadValidatorIndex = 16,
  WorkReportGasTooHigh = 17,
  ServiceItemGasTooLow = 18,
  TooManyDependencies = 19,
  SegmentRootLookupInvalid = 20,
  BadSignature = 21,
  WorkReportTooBig = 22,
}

export class Reports {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: ReportsState,
  ) {}

  transition(_input: ReportsInput): Result<ReportsOutput, ReportsError> {
    return Result.error(ReportsError.AnchorNotRecent);
  }
}
