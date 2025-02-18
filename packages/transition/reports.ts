import type { Ed25519Key, TimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees";
import type { SegmentRootLookupItem } from "@typeberry/block/work-report";
import type { KnownSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import type { State } from "@typeberry/state";
import { Result } from "@typeberry/utils";

// TODO [ToDr] docs

export type ReportsInput = {
  guarantees: GuaranteesExtrinsicView;
  slot: TimeSlot;
};

export type ReportsState = {
  readonly availabilityAssignment: State["availabilityAssignment"];
  readonly currentValidatorData: State["currentValidatorData"];
  readonly previousValidatorData: State["previousValidatorData"];
  readonly entropy: State["entropy"];
  readonly authPools: State["authPools"];
  readonly recentBlocks: State["recentBlocks"];
  readonly services: State["services"];

  // NOTE: this is most likely not strictly part of the state!
  readonly offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;
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
