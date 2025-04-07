import type { TransferListItem } from "node:worker_threads";
import type { IWithTransferList } from "@typeberry/concurrent/messages";
import type * as bandersnatchWasm from "bandersnatch-wasm/pkg";

export type Method = keyof typeof bandersnatchWasm;

export class Response implements IWithTransferList {
  constructor(public readonly data: Uint8Array) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}

export type IParams = {
  [M in Method]: { method: M } & (M extends "ring_commitment"
    ? { keys: Uint8Array }
    : M extends "verify_ticket"
      ? { keys: Uint8Array; ticketsData: Uint8Array; contextLength: number }
      : never);
}[Method];

export class Params implements IWithTransferList {
  constructor(public readonly params: IParams) {}

  getTransferList(): TransferListItem[] {
    return [];
  }
}
