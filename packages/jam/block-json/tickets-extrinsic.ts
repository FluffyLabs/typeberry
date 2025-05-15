import { BANDERSNATCH_PROOF_BYTES, type BandersnatchProof } from "@typeberry/block";
import { SignedTicket } from "@typeberry/block/tickets";
import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common";

const ticketEnvelopeFromJson = json.object<SignedTicket>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_PROOF_BYTES) as BandersnatchProof),
  },
  (x) => SignedTicket.create({ attempt: x.attempt, signature: x.signature }),
);

export const ticketsExtrinsicFromJson = json.array(ticketEnvelopeFromJson);
