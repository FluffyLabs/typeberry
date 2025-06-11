import { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import { json } from "@typeberry/json-parser";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/safrole/bandersnatch-vrf.js";
import { fromJson } from "./common.js";

const ticketEnvelopeFromJson = json.object<SignedTicket>(
  {
    attempt: fromJson.ticketAttempt,
    signature: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_PROOF_BYTES).asOpaque()),
  },
  (x) => SignedTicket.create({ attempt: x.attempt, signature: x.signature }),
);

export const ticketsExtrinsicFromJson = json.array(ticketEnvelopeFromJson);
