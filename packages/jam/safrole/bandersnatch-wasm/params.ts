import type { TransferListItem } from "node:worker_threads";
import type { WithTransferList } from "@typeberry/concurrent/messages";

export enum Method {
  RingCommitment = 0,
  VerifyTickets = 1,
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
      method: Method.VerifyTickets;
      keys: Uint8Array;
      ticketsData: Uint8Array;
      contextLength: number;
    };

export class Params implements WithTransferList {
  constructor(public readonly params: RawParams) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}
