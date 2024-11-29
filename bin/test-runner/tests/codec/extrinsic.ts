import { Extrinsic } from "@typeberry/block/block";
import { json } from "@typeberry/json-parser";
import { assurancesExtrinsicFromJson } from "./assurances-extrinsic";
import { runCodecTest } from "./common";
import { disputesExtrinsicFromJson } from "./disputes-extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees-extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages-extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets-extrinsic";

export const extrinsicFromJson = json.object<Extrinsic>(
  {
    tickets: ticketsExtrinsicFromJson,
    preimages: preimagesExtrinsicFromJson,
    guarantees: guaranteesExtrinsicFromJson,
    assurances: assurancesExtrinsicFromJson,
    disputes: disputesExtrinsicFromJson,
  },
  ({ tickets, preimages, guarantees, assurances, disputes }) =>
    new Extrinsic(tickets, preimages, guarantees, assurances, disputes),
);

export async function runExtrinsicTest(test: Extrinsic, file: string) {
  runCodecTest(Extrinsic.Codec, test, file);
}
