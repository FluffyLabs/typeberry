import { ConcurrentWorker } from "@typeberry/concurrent";
import { assertNever } from "@typeberry/utils";
import { ring_commitment, verify_ticket } from "bandersnatch-wasm/pkg";
import { Method, type Params, Response } from "./params";

export const worker = ConcurrentWorker.new<Params, Response, null>((p: Params) => {
  const params = p.params;
  const method = params.method;
  if (method === Method.RingCommitment) {
    return Promise.resolve(new Response(ring_commitment(params.keys)));
  }

  if (method === Method.VerifyTickets) {
    return Promise.resolve(new Response(verify_ticket(params.keys, params.ticketsData, params.contextLength)));
  }
  assertNever(method);
}, null);
