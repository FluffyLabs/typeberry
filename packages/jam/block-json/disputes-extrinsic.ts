import type { Epoch, ValidatorIndex, WorkReportHash } from "@typeberry/block";
import { Culprit, DisputesExtrinsic, Fault, Judgement, Verdict } from "@typeberry/block/disputes.js";
import { asKnownSize } from "@typeberry/collections";
import type { Ed25519Key, Ed25519Signature } from "@typeberry/crypto";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common.js";

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
  ({ target, vote, key, signature }) =>
    Fault.create({ workReportHash: target, wasConsideredValid: vote, key, signature }),
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
  ({ target, key, signature }) => Culprit.create({ workReportHash: target, key, signature }),
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
  ({ vote, index, signature }) => Judgement.create({ isWorkReportValid: vote, index, signature }),
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
  ({ target, age, votes }) => Verdict.create({ workReportHash: target, votesEpoch: age, votes: asKnownSize(votes) }),
);

export const disputesExtrinsicFromJson = json.object<DisputesExtrinsic>(
  {
    verdicts: json.array(verdictFromJson),
    culprits: json.array(culpritFromJson),
    faults: json.array(faultFromJson),
  },
  ({ verdicts, culprits, faults }) => DisputesExtrinsic.create({ verdicts, culprits, faults }),
);
