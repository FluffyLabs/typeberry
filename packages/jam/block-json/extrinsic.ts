import type { ChainSpec } from "@typeberry/config";
import { json } from "@typeberry/json-parser";
import {Extrinsic} from "@typeberry/block";

import { getAssurancesExtrinsicFromJson } from "./assurances-extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets-extrinsic";
import { disputesExtrinsicFromJson } from "./disputes-extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees-extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages-extrinsic";

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
      new Extrinsic(tickets, preimages, guarantees, assurances, disputes),
  );

