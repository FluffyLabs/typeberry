import type { FromJson } from "@typeberry/json-parser";
import { logger } from ".";
import { type AssurancesExtrinsic, AssurancesExtrinsicFromJson } from "./assurances_extrinsic";
import { DisputesExtrinsic } from "./disputes_extrinsic";
import { type GuaranteesExtrinsic, GuaranteesExtrinsicFromJson } from "./guarantees_extrinsic";
import { type PreimagesExtrinsic, PreimagesExtrinsicFromJson } from "./preimages_extrinsic";
import { type TicketsExtrinsic, TicketsExtrinsicFromJson } from "./tickets_extrinsic";

export class Extrinsic {
  static fromJson: FromJson<Extrinsic> = {
    tickets: TicketsExtrinsicFromJson,
    disputes: DisputesExtrinsic.fromJson,
    preimages: PreimagesExtrinsicFromJson,
    assurances: AssurancesExtrinsicFromJson,
    guarantees: GuaranteesExtrinsicFromJson,
  };

  tickets!: TicketsExtrinsic;
  disputes!: DisputesExtrinsic;
  preimages!: PreimagesExtrinsic;
  assurances!: AssurancesExtrinsic;
  guarantees!: GuaranteesExtrinsic;

  private constructor() {}
}

export async function runExtrinsicTest(test: Extrinsic, file: string) {
  logger.trace(JSON.stringify(test, null, 2));
  logger.error(`Not implemented yet! ${file}`);
}
