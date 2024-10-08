import assert from "node:assert";
import fs from "node:fs";
import { Extrinsic } from "@typeberry/block/block";
import { CodecContext } from "@typeberry/block/context";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { assurancesExtrinsicFromJson } from "./assurances_extrinsic";
import { disputesExtrinsicFromJson } from "./disputes_extrinsic";
import { guaranteesExtrinsicFromJson } from "./guarantees_extrinsic";
import { preimagesExtrinsicFromJson } from "./preimages_extrinsic";
import { ticketsExtrinsicFromJson } from "./tickets_extrinsic";

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
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));

  const myEncoded = Encoder.encodeObject(Extrinsic.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(Extrinsic.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
