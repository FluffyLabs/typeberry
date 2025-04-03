import type { Result } from "@typeberry/utils";

/** Message going from parent thread to worker thread. */
export type MessageIn<TParams> = {
  params: TParams;
};

/** Response from worker to the parent. */
export type MessageOut<TResult> = Result<TResult, string>;
