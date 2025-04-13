import { ConcurrentWorker } from "@typeberry/concurrent";
import { assertNever } from "@typeberry/utils";
import { batch_verify_tickets, ring_commitment, verify_seal } from "bandersnatch-wasm/pkg";
import { Method, type Params, Response } from "./params";

export const worker = ConcurrentWorker.new<Params, Response, null>((p: Params) => {
  const params = p.params;
  const method = params.method;
  if (method === Method.RingCommitment) {
    return Promise.resolve(new Response(ring_commitment(params.keys)));
  }

  if (method === Method.BatchVerifyTickets) {
    return Promise.resolve(new Response(batch_verify_tickets(params.keys, params.ticketsData, params.contextLength)));
  }

  if (method === Method.VerifySeal) {
    return Promise.resolve(
      new Response(verify_seal(params.keys, params.authorIndex, params.signature, params.payload, params.auxData)),
    );
  }
  assertNever(method);
}, null);
