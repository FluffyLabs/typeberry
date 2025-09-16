import type { Transferable } from "node:worker_threads";
import type { WithTransferList } from "@typeberry/concurrent/messages.js";

/**
 * Opaque number assigned to a verifier.
 *
 * Since the verifier is not "returned" from the worker, we just
 * need some identifier that will be passed to other methods
 * to choose which verifier should be used.
 *
 * NOTE: Semantically it's most sensible for this index to be just epoch number.
 */
export type VerifierIndex = number;

export enum Method {
  RingCommitment = 0,
  BatchVerifyTickets = 1,
  VerifySeal = 2,
}

export class Response implements WithTransferList {
  constructor(public readonly data: Uint8Array) {}

  getTransferList(): Transferable[] {
    return [this.data.buffer as ArrayBuffer];
  }
}

export type RawParams =
  | {
      method: Method.RingCommitment;
      keys: Uint8Array;
    }
  | {
      method: Method.BatchVerifyTickets;
      ringSize: number;
      commitment: Uint8Array;
      ticketsData: Uint8Array;
      contextLength: number;
    }
  | {
      method: Method.VerifySeal;
      authorKey: Uint8Array;
      signature: Uint8Array;
      payload: Uint8Array;
      auxData: Uint8Array;
    };

export class Params implements WithTransferList {
  constructor(public readonly params: RawParams) {}

  getTransferList(): Transferable[] {
    return [];
  }
}
