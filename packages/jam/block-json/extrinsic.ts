import { Extrinsic } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";

import { getAssurancesExtrinsicFromJson } from "./assurances-extrinsic.js";
import { disputesExtrinsicFromJson } from "./disputes-extrinsic.js";
import { guaranteesExtrinsicFromJson } from "./guarantees-extrinsic.js";
import { preimagesExtrinsicFromJson } from "./preimages-extrinsic.js";
import { ticketsExtrinsicFromJson } from "./tickets-extrinsic.js";

export const getExtrinsicFromJson = (ctx: ChainSpec) =>
  json.object<Extrinsic>(
    {
      tickets: ticketsExtrinsicFromJson,
      preimages: preimagesExtrinsicFromJson,
      guarantees: guaranteesExtrinsicFromJson,
      assurances: getAssurancesExtrinsicFromJson(ctx),
      disputes: disputesExtrinsicFromJson,
    },
    ({ tickets, preimages, guarantees, assurances, disputes }) =>
      Extrinsic.create({ tickets, preimages, guarantees, assurances, disputes }),
  );
