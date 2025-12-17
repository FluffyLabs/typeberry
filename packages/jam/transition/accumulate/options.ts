import type { PvmBackend } from "@typeberry/config";

export type AccumulateOptions = {
  pvm: PvmBackend;
  accumulateSequentially: boolean;
};
