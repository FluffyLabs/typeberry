import assert from "node:assert";
import fs from "node:fs";
import { CodecContext } from "@typeberry/block/context";
import { Culprit, DisputesExtrinsic, Fault, Judgement, Verdict } from "@typeberry/block/disputes";
import { BytesBlob } from "@typeberry/bytes";
import { Decoder, Encoder } from "@typeberry/codec";
import { json } from "@typeberry/json-parser";
import { bytes32, fromJson } from ".";

const faultFromJson = json.object<Fault>(
  {
    target: bytes32(),
    vote: "boolean",
    key: bytes32(),
    signature: fromJson.ed25519Signature,
  },
  ({ target, vote, key, signature }) => new Fault(target, vote, key, signature),
);

const culpritFromJson = json.object<Culprit>(
  {
    target: bytes32(),
    key: bytes32(),
    signature: fromJson.ed25519Signature,
  },
  ({ target, key, signature }) => new Culprit(target, key, signature),
);

const judgementFromJson = json.object<Judgement>(
  {
    vote: "boolean",
    index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ vote, index, signature }) => new Judgement(vote, index, signature),
);

const verdictFromJson = json.object<Verdict>(
  {
    target: bytes32(),
    age: "number",
    votes: json.array(judgementFromJson),
  },
  ({ target, age, votes }) => new Verdict(target, age, votes),
);

export const disputesExtrinsicFromJson = json.object<DisputesExtrinsic>(
  {
    verdicts: json.array(verdictFromJson),
    culprits: json.array(culpritFromJson),
    faults: json.array(faultFromJson),
  },
  ({ verdicts, culprits, faults }) => new DisputesExtrinsic(verdicts, culprits, faults),
);

export async function runDisputesExtrinsicTest(test: DisputesExtrinsic, file: string) {
  const encoded = new Uint8Array(fs.readFileSync(file.replace("json", "bin")));
  const myEncoded = Encoder.encodeObject(DisputesExtrinsic.Codec, test, new CodecContext());
  assert.deepStrictEqual(myEncoded.toString(), BytesBlob.fromBlob(encoded).toString());

  const decoded = Decoder.decodeObject(DisputesExtrinsic.Codec, encoded, new CodecContext());
  assert.deepStrictEqual(decoded, test);
}
