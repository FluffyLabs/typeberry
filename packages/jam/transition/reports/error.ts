/** Error that may happen during reports processing. */
export enum ReportsError {
  /** Core index is greater than the number of available cores. */
  BadCoreIndex = 0,
  /** The report slot is greater than the current block slot. */
  FutureReportSlot = 1,
  /** Report is too old to be considered. */
  ReportEpochBeforeLast = 2,
  /** Not enough credentials for the guarantee. */
  InsufficientGuarantees = 3,
  /** Guarantees are not ordered by the core index. */
  OutOfOrderGuarantee = 4,
  /** Credentials of guarantors are not sorted or unique. */
  NotSortedOrUniqueGuarantors = 5,
  /** Validator in credentials is assigned to a different core. */
  WrongAssignment = 6,
  /** There is a report pending availability on that core already. */
  CoreEngaged = 7,
  /** Anchor block is not found in recent blocks. */
  AnchorNotRecent = 8,
  /** Service not foubd. */
  BadServiceId = 9,
  /** Service code hash does not match the current one. */
  BadCodeHash = 10,
  /** Pre-requisite work package is missing in either recent blocks or lookup extrinsic. */
  DependencyMissing = 11,
  /** Results for the same package are in more than one report. */
  DuplicatePackage = 12,
  /** Anchor block declared state root does not match the one we have in recent blocks. */
  BadStateRoot = 13,
  /** BEEFY super hash mmr mismatch. */
  BadBeefyMmrRoot = 14,
  /** The authorization hash is not found in the authorization pool. */
  CoreUnauthorized = 15,
  /** Validator index is greater than the number of validators. */
  BadValidatorIndex = 16,
  /** Total gas of work report is too high. */
  WorkReportGasTooHigh = 17,
  /** Work item has is smaller than required minimal accumulation gas of a service. */
  ServiceItemGasTooLow = 18,
  /** The report has too many dependencies (prerequisites and/or segment-root lookups). */
  TooManyDependencies = 19,
  /** Segment root lookup block has invalid time slot or is not found in the header chain. */
  SegmentRootLookupInvalid = 20,
  /** Signature in credentials is invalid. */
  BadSignature = 21,
  /** Size of authorizer output and all work-item successful output blobs is too big. */
  WorkReportTooBig = 22,
}
