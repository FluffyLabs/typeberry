import type { PVMInterpreter } from "@typeberry/config-node";
import { ChainSpec } from "./chain-spec.js";

/**
 * Configuration object for typeberry workers.
 */
export class WorkerConfig {
  /**
   * Since we loose prototypes when transferring the context,
   * this function is re-initializing proper types.
   *
   * TODO [ToDr] instead of doing this hack, we might prefer to pass data
   * between workers using JAM codec maybe?
   */
  static reInit(config: unknown) {
    const { chainSpec, dbPath, omitSealVerification, pvm } = config as WorkerConfig;
    return new WorkerConfig(new ChainSpec(chainSpec), dbPath, pvm, omitSealVerification);
  }

  constructor(
    public readonly chainSpec: ChainSpec,
    public readonly dbPath: string,
    public readonly pvm: PVMInterpreter,
    public readonly omitSealVerification: boolean = false,
  ) {}
}
