import type { CoreIndex, ServiceId } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/safrole";
import { Result } from "@typeberry/utils";
import type {
  AUTHORIZATION_QUEUE_SIZE,
  AccumulationPartialState,
  TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];
  public readonly validatorsData: Parameters<TestAccumulate["updateValidatorsData"]>[0][] = [];
  public readonly transferData: Parameters<TestAccumulate["transfer"]>[] = [];
  public checkpointCalled = 0;
  public transferReturnValue: Result<null, TransferError> = Result.ok(null);

  transfer(
    destination: ServiceId,
    amount: U64,
    suppliedGas: Gas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<null, TransferError> {
    this.transferData.push([destination, amount, suppliedGas, memo]);
    return this.transferReturnValue;
  }

  checkpoint(): void {
    this.checkpointCalled += 1;
  }

  updateValidatorsData(validatorsData: KnownSizeArray<ValidatorData, "ValidatorsCount">): void {
    this.validatorsData.push(validatorsData);
  }

  updatePrivilegedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, Gas>): void {
    this.privilegedServices.push([m, a, v, g]);
  }

  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>,
  ): void {
    this.authQueue.push([coreIndex, authQueue]);
  }
}
