import type { Extrinsic, TimeSlot, ValidatorIndex } from "@typeberry/block";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { ChainSpec } from "@typeberry/config";
import { check } from "@typeberry/utils";
import { ActivityRecord, type StatisticsState } from "./statistics-state";

export class Statistics {
  constructor(
    public readonly state: StatisticsState,
    private readonly chainSpec: ChainSpec,
  ) {}

  private getValidatorsStatistics(slot: TimeSlot) {
    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18bd0118bd01
     */
    const currentEpoch = Math.floor(this.state.tau / this.chainSpec.epochLength);
    const nextEpoch = Math.floor(slot / this.chainSpec.epochLength);

    /**
     * e === e'
     *
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18fb0118fb01
     */
    if (currentEpoch === nextEpoch) {
      return this.state.pi;
    }

    /**
     * e !== e'
     *
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18fb0118fb01
     */
    const current = new Array(this.chainSpec.validatorsCount);

    for (let i = 0; i < this.chainSpec.validatorsCount; i++) {
      current[i] = ActivityRecord.empty();
    }

    return {
      current,
      last: this.state.pi.current,
    };
  }

  private sumPreimageSizes(preimages: PreimagesExtrinsic) {
    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18a60218a602
     */
    let sum = 0;

    for (const preimage of preimages) {
      sum += preimage.blob.length;
    }

    return sum;
  }

  transition(slot: TimeSlot, authorIndex: ValidatorIndex, extrinsic: Extrinsic) {
    /**
     * get the validators statistics for the current epoch
     */
    const validatorsStatistics = this.getValidatorsStatistics(slot);
    const { current } = validatorsStatistics;
    check(current[authorIndex] !== undefined, "authorIndex is out of bounds");

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/184b02184b02
     */
    current[authorIndex].blocks += 1;

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/185e02185e02
     */
    current[authorIndex].tickets += extrinsic.tickets.length;

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/188202189a02
     */
    current[authorIndex].preImages += extrinsic.preimages.length;

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18a60218a602
     */
    current[authorIndex].preImagesSize += this.sumPreimageSizes(extrinsic.preimages);

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18cc0218d002
     *
     * Please note I don't use Kappa' here so probably it is incorrect (despite it passes the tests)!
     * If I udnderstand GP correctly we should match validators from Kappa' and data from guarantees extrinsic using
     * signature (calculate a new signature using validator ed25519 public key and compare it with the signature from the extrinsic),
     * but the problem is that everything except validator index is empty in extrinsic (in the test vectors).
     */
    for (const { credentials } of extrinsic.guarantees) {
      for (const { validatorIndex } of credentials) {
        current[validatorIndex].guarantees += 1;
      }
    }

    /**
     * https://graypaper.fluffylabs.dev/#/6e1c0cd/18dc0218dc02
     */
    for (const assurance of extrinsic.assurances) {
      current[assurance.validatorIndex].assurances += 1;
    }

    /**
     * update the state with the new validators statistics
     */
    this.state.pi = validatorsStatistics;
  }
}
