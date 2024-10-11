import type { Ed25519Key, Ed25519Signature, Epoch, ValidatorIndex, WorkReportHash } from "@typeberry/block";
import { Culprit, DisputesExtrinsic, Fault, Judgement, Verdict } from "@typeberry/block/disputes";
import { json } from "@typeberry/json-parser";
import { fromJson, runCodecTest } from ".";

type JsonFault = {
  target: WorkReportHash;
  vote: boolean;
  key: Ed25519Key;
  signature: Ed25519Signature;
};
const faultFromJson = json.object<JsonFault, Fault>(
  {
    target: fromJson.bytes32(),
    vote: "boolean",
    key: fromJson.bytes32(),
    signature: fromJson.ed25519Signature,
  },
  ({ target, vote, key, signature }) => new Fault(target, vote, key, signature),
);

type JsonCulprit = {
  target: WorkReportHash;
  key: Ed25519Key;
  signature: Ed25519Signature;
};
const culpritFromJson = json.object<JsonCulprit, Culprit>(
  {
    target: fromJson.bytes32(),
    key: fromJson.bytes32(),
    signature: fromJson.ed25519Signature,
  },
  ({ target, key, signature }) => new Culprit(target, key, signature),
);

type JsonJudgement = {
  vote: boolean;
  index: ValidatorIndex;
  signature: Ed25519Signature;
};
const judgementFromJson = json.object<JsonJudgement, Judgement>(
  {
    vote: "boolean",
    index: "number",
    signature: fromJson.ed25519Signature,
  },
  ({ vote, index, signature }) => new Judgement(vote, index, signature),
);

type JsonVerdict = {
  target: WorkReportHash;
  age: Epoch;
  votes: Judgement[];
};

const verdictFromJson = json.object<JsonVerdict, Verdict>(
  {
    target: fromJson.bytes32(),
    age: "number",
    votes: json.array(judgementFromJson),
  },
  ({ target, age, votes }) => new Verdict(target, age, votes as Verdict["votes"]),
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
  runCodecTest(DisputesExtrinsic.Codec, test, file);
}
