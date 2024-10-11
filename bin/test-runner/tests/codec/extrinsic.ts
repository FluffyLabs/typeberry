import { Extrinsic } from "@typeberry/block/block";
import { json } from "@typeberry/json-parser";
import { runCodecTest } from ".";
import { assurancesExtrinsicFromJson } from "./assurances-extrinsic";
import { disputesExtrinsicFromJson } from "./disputes-extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees-extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages-extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets-extrinsic";

export const extrinsicFromJson = json.object<Extrinsic>(
  {
    tickets: ticketsExtrinsicFromJson,
    disputes: disputesExtrinsicFromJson,
    preimages: preimagesExtrinsicFromJson,
    assurances: assurancesExtrinsicFromJson,
    guarantees: guaranteesExtrinsicFromJson,
  },
  ({ tickets, disputes, preimages, assurances, guarantees }) =>
    new Extrinsic(tickets, disputes, preimages, assurances, guarantees),
);

export async function runExtrinsicTest(test: Extrinsic, file: string) {
  runCodecTest(Extrinsic.Codec, test, file);
}
