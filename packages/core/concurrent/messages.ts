import type { Transferable } from "node:worker_threads";
import type { Result } from "@typeberry/utils";

export interface IExecutor<TParams, TResult> {
  run(params: TParams): Promise<TResult>;
  destroy(): Promise<void>;
}

export type WithTransferList = {
  getTransferList(): Transferable[];
};

/** Message going from parent thread to worker thread. */
export type MessageIn<TParams> = {
  params: TParams;
};

/** Response from worker to the parent. */
export type MessageOut<TResult> = Result<TResult, string>;
