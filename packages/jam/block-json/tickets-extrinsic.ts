import { SignedTicket } from "@typeberry/block/tickets.js";
import { Bytes } from "@typeberry/bytes";
import type { ChainSpec } from "@typeberry/config";
import { BANDERSNATCH_PROOF_BYTES } from "@typeberry/crypto/bandersnatch.js";
import { json } from "@typeberry/json-parser";
import { fromJson } from "./common.js";

export const ticketsExtrinsicFromJson = (spec: ChainSpec) => {
  const ticketEnvelopeFromJson = json.object<SignedTicket>(
    {
      attempt: fromJson.ticketAttempt(spec),
      signature: json.fromString((v) => Bytes.parseBytes(v, BANDERSNATCH_PROOF_BYTES).asOpaque()),
    },
    (x) => SignedTicket.create({ attempt: x.attempt, signature: x.signature }),
  );

  return json.array(ticketEnvelopeFromJson);
};
