import type { AssurancesExtrinsic } from "@typeberry/block/assurances";
import type { DisputesExtrinsic } from "@typeberry/block/disputes";
import type { GuaranteesExtrinsic } from "@typeberry/block/gaurantees";
import type { PreimagesExtrinsic } from "@typeberry/block/preimage";
import type { TicketsExtrinsic } from "@typeberry/block/tickets";
import { json } from "@typeberry/json-parser";
import { logger } from ".";
import { assurancesExtrinsicFromJson } from "./assurances_extrinsic";
import { disputesExtrinsicFromJson } from "./disputes_extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees_extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages_extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets_extrinsic";

export class Extrinsic {
  static fromJson = json.object<Extrinsic>(
    {
      tickets: ticketsExtrinsicFromJson,
      disputes: disputesExtrinsicFromJson,
      preimages: preimagesExtrinsicFromJson,
      assurances: assurancesExtrinsicFromJson,
      guarantees: guaranteesExtrinsicFromJson,
    },
    (v) => Object.assign(new Extrinsic(), v),
  );

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
