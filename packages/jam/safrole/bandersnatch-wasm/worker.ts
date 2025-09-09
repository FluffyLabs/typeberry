import { ConcurrentWorker } from "@typeberry/concurrent";
import { bandersnatchWasm } from "@typeberry/crypto";
import { assertNever } from "@typeberry/utils";
import { Method, type Params, Response } from "./params.js";

export const worker = ConcurrentWorker.new<Params, Response, null>(async (p: Params) => {
  const params = p.params;
  const method = params.method;
  if (method === Method.RingCommitment) {
    return Promise.resolve(new Response(bandersnatchWasm.ring_commitment(params.keys)));
  }

  if (method === Method.BatchVerifyTickets) {
    return Promise.resolve(
      new Response(bandersnatchWasm.batch_verify_tickets(params.keys, params.ticketsData, params.contextLength)),
    );
  }

  if (method === Method.VerifySeal) {
    return Promise.resolve(
      new Response(
        bandersnatchWasm.verify_seal(params.keys, params.authorIndex, params.signature, params.payload, params.auxData),
      ),
    );
  }
  assertNever(method);
}, null);
