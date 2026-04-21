import { type CoreIndex, type ServiceGas, tryAsServiceGas } from "@typeberry/block";
import { G_I, W_A } from "@typeberry/block/gp-constants.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import type { WorkPackage } from "@typeberry/block/work-package.js";
import { BytesBlob } from "@typeberry/bytes";
import { codec, Encoder } from "@typeberry/codec";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import { PvmExecutor, ReturnStatus } from "@typeberry/executor";
import type { Blake2b } from "@typeberry/hash";
import type { State } from "@typeberry/state";
import type { WorkPackageFetchData } from "@typeberry/transition/externalities/fetch-externalities.js";
import { Result } from "@typeberry/utils";
import { IsAuthorizedFetchExternalities } from "./externalities/index.js";

export enum AuthorizationError {
  /** BAD: authorizer code not found (service or preimage missing). */
  CodeNotFound = 0,
  /** BIG: authorizer code exceeds W_A limit. */
  CodeTooBig = 1,
  /** PANIC/OOG: PVM execution failed. */
  PvmFailed = 2,
}

export type AuthorizationOk = {
  authorizerHash: AuthorizerHash;
  authorizationGasUsed: ServiceGas;
  authorizationOutput: BytesBlob;
};

const AUTH_ARGS_CODEC = codec.object({
  coreIndex: codec.u16,
});

/**
 * IsAuthorized PVM invocation (Psi_I).
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e64002e6400?v=0.7.2
 */
export class IsAuthorized {
  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly pvmBackend: PvmBackend,
    private readonly blake2b: Blake2b,
  ) {}

  async invoke(
    state: State,
    coreIndex: CoreIndex,
    workPackage: WorkPackage,
    packageFetchData: WorkPackageFetchData,
  ): Promise<Result<AuthorizationOk, AuthorizationError>> {
    const { authCodeHost, authCodeHash, authConfiguration } = workPackage;

    // Look up the authorizer code from the auth code host service
    const service = state.getService(authCodeHost);
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/2eca002eca00?v=0.7.2
    if (service === null) {
      return Result.error(
        AuthorizationError.CodeNotFound,
        () => `Auth code host service ${authCodeHost} not found in state.`,
      );
    }

    const code = service.getPreimage(authCodeHash.asOpaque());
    if (code === null) {
      return Result.error(
        AuthorizationError.CodeNotFound,
        () => `Auth code preimage ${authCodeHash} not found in service ${authCodeHost}.`,
      );
    }

    // BIG: code exceeds W_A
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/2ed6002ed600?v=0.7.2
    if (code.length > W_A) {
      return Result.error(
        AuthorizationError.CodeTooBig,
        () => `Auth code is too big: ${code.length} bytes vs ${W_A} max.`,
      );
    }

    // Prepare fetch externalities and executor
    const fetchExternalities = new IsAuthorizedFetchExternalities(this.chainSpec, packageFetchData);
    const executor = await PvmExecutor.createIsAuthorizedExecutor(
      authCodeHost,
      code,
      { fetchExternalities },
      this.pvmBackend,
    );

    const args = Encoder.encodeObject(AUTH_ARGS_CODEC, {
      coreIndex,
    });

    // Run PVM with gas budget G_I
    const gasLimit = tryAsServiceGas(G_I);
    const execResult = await executor.run(args, gasLimit);

    if (execResult.status !== ReturnStatus.OK) {
      return Result.error(
        AuthorizationError.PvmFailed,
        () => `IsAuthorized PVM ${ReturnStatus[execResult.status]} (gas used: ${execResult.consumedGas}).`,
      );
    }

    // Compute authorizer hash: H(code_hash ++ configuration)
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/1b81011b8401?v=0.7.2
    const authorizerHash = this.blake2b.hashBlobs<AuthorizerHash>([authCodeHash, authConfiguration]);
    const authorizationOutput = BytesBlob.blobFrom(execResult.memorySlice);
    const authorizationGasUsed = tryAsServiceGas(execResult.consumedGas);

    return Result.ok({ authorizerHash, authorizationGasUsed, authorizationOutput });
  }
}
