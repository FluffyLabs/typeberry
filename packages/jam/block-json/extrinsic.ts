import { Extrinsic } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";

import { getAssurancesExtrinsicFromJson } from "./assurances-extrinsic";
import { disputesExtrinsicFromJson } from "./disputes-extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees-extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages-extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets-extrinsic";

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
