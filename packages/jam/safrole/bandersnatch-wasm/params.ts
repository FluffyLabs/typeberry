import type { TransferListItem } from "node:worker_threads";
import type { WithTransferList } from "@typeberry/concurrent/messages";

export enum Method {
  RingCommitment = 0,
  BatchVerifyTickets = 1,
  VerifySeal = 2,
}

export class Response implements WithTransferList {
  constructor(public readonly data: Uint8Array) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}

export type RawParams =
  | {
      method: Method.RingCommitment;
      keys: Uint8Array;
    }
  | {
      method: Method.BatchVerifyTickets;
      keys: Uint8Array;
      ticketsData: Uint8Array;
      contextLength: number;
    }
  | {
      method: Method.VerifySeal;
      keys: Uint8Array;
      authorIndex: number;
      signature: Uint8Array;
      payload: Uint8Array;
      auxData: Uint8Array;
    };

export class Params implements WithTransferList {
  constructor(public readonly params: RawParams) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}
