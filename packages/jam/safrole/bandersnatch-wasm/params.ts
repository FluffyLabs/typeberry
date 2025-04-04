import type { TransferListItem } from "node:worker_threads";
import type { IWithTransferList } from "@typeberry/concurrent/messages";

export enum Method {
  RingCommitment = 0,
  VerifyTickets = 1,
}

export class Response implements IWithTransferList {
  constructor(public readonly data: Uint8Array) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}

export type IParams =
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

export class Params implements IWithTransferList {
  constructor(public readonly params: IParams) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}
