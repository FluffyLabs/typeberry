import { type PerValidator, type TimeSlot, type WorkReportHash, tryAsTimeSlot } from "@typeberry/block";
import type { GuaranteesExtrinsicView } from "@typeberry/block/guarantees.js";
import type { WorkPackageHash, WorkPackageInfo } from "@typeberry/block/work-report.js";
import { type BytesBlob, bytesBlobComparator } from "@typeberry/bytes";
import { type HashDictionary, type KnownSizeArray, SortedSet, asKnownSize } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type Ed25519Key, ed25519 } from "@typeberry/crypto";
import { type KeccakHash, WithHash, blake2b } from "@typeberry/hash";
import type { MmrHasher } from "@typeberry/mmr";
import type { SafroleStateUpdate } from "@typeberry/safrole";
import { AvailabilityAssignment, type State, tryAsPerCore } from "@typeberry/state";
import { OK, Result, asOpaqueType } from "@typeberry/utils";
import type { AssurancesStateUpdate } from "../assurances.js";
import type { RecentHistoryStateUpdate } from "../recent-history.js";
import { ReportsError } from "./error.js";
import { generateCoreAssignment, rotationIndex } from "./guarantor-assignment.js";
import { verifyReportsBasic } from "./verify-basic.js";
import { type HeaderChain, verifyContextualValidity } from "./verify-contextual.js";
import { type GuarantorAssignment, verifyCredentials } from "./verify-credentials.js";
import { verifyReportsOrder } from "./verify-order.js";
import { verifyPostSignatureChecks } from "./verify-post-signature.js";

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
};

export type ReportsState = Pick<
  State,
  | "availabilityAssignment"
  | "currentValidatorData"
  | "previousValidatorData"
  | "entropy"
  | "getService"
  | "authPools"
  | "recentBlocks"
  | "accumulationQueue"
  | "recentlyAccumulated"
>;

// NOTE: this is most likely part of the `disputesState`, but I'm not sure what
// to do with that exactly. It's being passed in the JAM test vectors, but isn't used?
// TODO [ToDr] Seems that section 11 does not specify when this should be updated.
// I guess we need to check that later with the GP.
// readonly offenders: KnownSizeArray<Ed25519Key, "0..ValidatorsCount">;

/** Reports state update. */
export type ReportsStateUpdate = Pick<ReportsState, "availabilityAssignment">;

export type ReportsOutput = {
  /** Altered state. */
  stateUpdate: ReportsStateUpdate;
  /**
   * All work Packages and their segment roots reported in the extrinsic.
   *
   * This dictionary has the same number of items as in the input guarantees extrinsic.
   */
  reported: HashDictionary<WorkPackageHash, WorkPackageInfo>;
  /** A set `R` of work package reporters. */
  reporters: KnownSizeArray<Ed25519Key, "Guarantees * Credentials (at most `cores*3`)">;
};

export class Reports {
  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly state: ReportsState,
    public readonly mmrHasher: MmrHasher<KeccakHash>,
    public readonly headerChain: HeaderChain,
  ) {}

  async transition(input: ReportsInput): Promise<Result<ReportsOutput, ReportsError>> {
    // verify ordering of work reports.
    const reportsOrderResult = verifyReportsOrder(input.guarantees, this.chainSpec);
    if (reportsOrderResult.isError) {
      return reportsOrderResult;
    }

    // check some basic reports validity
    const reportsValidity = verifyReportsBasic(input.guarantees);
    if (reportsValidity.isError) {
      return reportsValidity;
    }

    // calculate hashes of all work reports in the guarantees extrinsic (one per guarantee)
    const workReportHashes = this.workReportHashes(input.guarantees);

    // verifying credentials for all the work reports
    // but also slot & core assignment.
    // returns actual signatures that need to be checked (async)
    const signaturesToVerify = this.verifyCredentials(input, workReportHashes);
    if (signaturesToVerify.isError) {
      return signaturesToVerify;
    }

    // Actually verify signatures
    const verifySignaturesLater = ed25519.verify(signaturesToVerify.ok);

    // Perform rest of the work in the meantime.
    const restResult = this.verifyPostSignatureChecks(input.guarantees);
    if (restResult.isError) {
      return restResult;
    }

    // confirm contextual validity
    const contextualValidity = this.verifyContextualValidity(input);
    if (contextualValidity.isError) {
      return contextualValidity;
    }

    // check signatures correctness
    const signaturesOk = this.checkSignatures(signaturesToVerify.ok, await verifySignaturesLater);
    if (signaturesOk.isError) {
      return signaturesOk;
    }

    /**
     * ρ′ - equivalent to ρ‡, except where the extrinsic replaced
     * an entry. In the case an entry is replaced, the new value
     * includes the present time τ ′ allowing for the value to be
     * replaced without respect to its availability once sufficient
     * time has elapsed.
     * https://graypaper.fluffylabs.dev/#/1c979cb/161e00165900?v=0.7.1
     */
    let index = 0;
    const availabilityAssignment = input.assurancesAvailAssignment.slice();

    for (const guarantee of input.guarantees) {
      const report = guarantee.view().report.materialize();
      const workPackageHash = workReportHashes[index];
      availabilityAssignment[report.coreIndex] = AvailabilityAssignment.create({
        workReport: new WithHash(workPackageHash, report),
        timeout: input.slot,
      });
      index += 1;
    }

    return Result.ok({
      stateUpdate: {
        availabilityAssignment: tryAsPerCore(availabilityAssignment, this.chainSpec),
      },
      reported: contextualValidity.ok,
      reporters: asKnownSize(
        SortedSet.fromArray(
          bytesBlobComparator,
          signaturesToVerify.ok.map((x) => x.key),
        ).slice(),
      ),
    });
  }

  workReportHashes(input: GuaranteesExtrinsicView): KnownSizeArray<WorkReportHash, "Guarantees"> {
    const workReportHashes: WorkReportHash[] = [];
    for (const guarantee of input) {
      workReportHashes.push(asOpaqueType(blake2b.hashBytes(guarantee.view().report.encoded())));
    }
    return asKnownSize(workReportHashes);
  }

  verifyCredentials(input: ReportsInput, workReportHashes: KnownSizeArray<WorkReportHash, "Guarantees">) {
    return verifyCredentials(input.guarantees, workReportHashes, input.slot, (headerTimeSlot, guaranteeTimeSlot) =>
      this.getGuarantorAssignment(headerTimeSlot, guaranteeTimeSlot, input.newEntropy),
    );
  }

  verifyPostSignatureChecks(input: GuaranteesExtrinsicView) {
    return verifyPostSignatureChecks(input, this.state.availabilityAssignment, this.state.authPools, (id) =>
      this.state.getService(id),
    );
  }

  verifyContextualValidity(input: ReportsInput) {
    return verifyContextualValidity(input, this.state, this.mmrHasher, this.headerChain);
  }

  checkSignatures(
    signaturesToVerify: ed25519.Input<BytesBlob>[],
    signaturesValid: boolean[],
  ): Result<OK, ReportsError> {
    if (signaturesValid.every((isValid) => isValid)) {
      return Result.ok(OK);
    }

    // we have invalid signatures, let's return nice error messages
    const invalidKeys = signaturesValid
      .map((isValid, idx) => {
        if (isValid) {
          return null;
        }
        return signaturesToVerify[idx].key;
      })
      .filter((x) => x !== null);

    return Result.error(
      ReportsError.BadSignature,
      `Invalid signatures for validators with keys: ${invalidKeys.join(", ")}`,
    );
  }

  /**
   * Get the guarantor assignment (both core and validator data)
   * depending on the rotation.
   *
   * https://graypaper.fluffylabs.dev/#/5f542d7/158200158200
   */
  getGuarantorAssignment(
    headerTimeSlot: TimeSlot,
    guaranteeTimeSlot: TimeSlot,
    newEntropy: SafroleStateUpdate["entropy"],
  ): Result<PerValidator<GuarantorAssignment>, ReportsError> {
    const epochLength = this.chainSpec.epochLength;
    const rotationPeriod = this.chainSpec.rotationPeriod;
    const headerRotation = rotationIndex(headerTimeSlot, rotationPeriod);
    const guaranteeRotation = rotationIndex(guaranteeTimeSlot, rotationPeriod);
    const minTimeSlot = Math.max(0, headerRotation - 1) * rotationPeriod;

    // https://graypaper.fluffylabs.dev/#/5f542d7/155e00156900
    if (guaranteeTimeSlot > headerTimeSlot) {
      return Result.error(
        ReportsError.FutureReportSlot,
        `Report slot is in future. Block ${headerTimeSlot}, Report: ${guaranteeTimeSlot}`,
      );
    }

    if (guaranteeTimeSlot < minTimeSlot) {
      return Result.error(
        ReportsError.ReportEpochBeforeLast,
        `Report slot is too old. Block ${headerTimeSlot}, Report: ${guaranteeTimeSlot}`,
      );
    }

    // TODO [ToDr] [opti] below code needs cache.
    // The `G` and `G*` sets should only be computed once per rotation.

    // Default data for the current rotation
    let entropy = newEntropy[2];
    let validatorData = this.state.currentValidatorData;
    let timeSlot = headerTimeSlot;

    // we might need a different set of data
    if (headerRotation > guaranteeRotation) {
      // we can safely subtract here, because if `guaranteeRotation` is less
      // than header rotation it must be greater than the `rotationPeriod`.
      timeSlot = tryAsTimeSlot(headerTimeSlot - rotationPeriod);

      // if the epoch changed, we need to take previous entropy and previous validator data.
      if (isPreviousRotationPreviousEpoch(timeSlot, headerTimeSlot, epochLength)) {
        entropy = newEntropy[3];
        validatorData = this.state.previousValidatorData;
      }
    }

    // we know which entropy, timeSlot and validatorData should be used,
    // so we can compute `G` or `G*` here.
    const coreAssignment = generateCoreAssignment(this.chainSpec, entropy, timeSlot);
    return Result.ok(
      zip(coreAssignment, validatorData, (core, validator) => ({
        core,
        ed25519: validator.ed25519,
      })),
    );
  }
}

function isPreviousRotationPreviousEpoch(
  previousRotationTimeSlot: TimeSlot,
  currentRotationTimeSlot: TimeSlot,
  epochLength: number,
) {
  const currentEpoch = Math.floor(currentRotationTimeSlot / epochLength);
  const maybePreviousEpoch = Math.floor(previousRotationTimeSlot / epochLength);
  const isPrevious = maybePreviousEpoch !== currentEpoch;
  return isPrevious;
}

/**
 * Compose two collections of the same size into a single one
 * containing some amalgamation of both items.
 */
function zip<A, B, R>(a: PerValidator<A>, b: PerValidator<B>, fn: (a: A, b: B) => R): PerValidator<R> {
  return asKnownSize(
    a.map((aValue, index) => {
      return fn(aValue, b[index]);
    }),
  );
}
