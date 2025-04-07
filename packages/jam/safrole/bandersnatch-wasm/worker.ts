import { ConcurrentWorker } from "@typeberry/concurrent";
import { assertNever } from "@typeberry/utils";
import { ring_commitment, verify_ticket } from "bandersnatch-wasm/pkg";
import { type Params, Response } from "./params";

export const worker = ConcurrentWorker.new<Params, Response, null>((p: Params) => {
  const params = p.params;
  const method = params.method;
  if (method === 'ring_commitment') {
    return Promise.resolve(new Response(ring_commitment(params.keys)));
  }

  if (method === 'verify_ticket') {
    return Promise.resolve(new Response(verify_ticket(params.keys, params.ticketsData, params.contextLength)));
  }
  assertNever(method);
}, null);
