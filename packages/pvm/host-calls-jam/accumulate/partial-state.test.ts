import type { CodeHash, CoreIndex, ServiceId } from "@typeberry/block";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/safrole";
import { Result } from "@typeberry/utils";
import type {
  AUTHORIZATION_QUEUE_SIZE,
  AccumulationPartialState,
  QuitError,
  TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];
  public readonly newServiceCalled: Parameters<TestAccumulate["newService"]>[] = [];
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly quitAndTransferData: Parameters<TestAccumulate["quitAndTransfer"]>[] = [];
  public readonly transferData: Parameters<TestAccumulate["transfer"]>[] = [];
  public readonly upgradeData: Parameters<TestAccumulate["upgradeService"]>[] = [];
  public readonly validatorsData: Parameters<TestAccumulate["updateValidatorsData"]>[0][] = [];

  public checkpointCalled = 0;
  public newServiceResponse: ServiceId | null = null;
  public quitAndBurnCalled = 0;
  public transferReturnValue: Result<null, TransferError> = Result.ok(null);
  public quitReturnValue: Result<null, QuitError> = Result.ok(null);

  quitAndTransfer(destination: ServiceId, suppliedGas: Gas, memo: Bytes<TRANSFER_MEMO_BYTES>): Result<null, QuitError> {
    this.quitAndTransferData.push([destination, suppliedGas, memo]);
    return this.quitReturnValue;
  }

  quitAndBurn(): void {
    this.quitAndBurnCalled += 1;
  }

  transfer(
    destination: ServiceId,
    amount: U64,
    suppliedGas: Gas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<null, TransferError> {
    this.transferData.push([destination, amount, suppliedGas, memo]);
    return this.transferReturnValue;
  }

  newService(
    requestedServiceId: ServiceId,
    codeHash: CodeHash,
    codeLength: U32,
    gas: U64,
    balance: U64,
  ): Result<ServiceId, "insufficient funds"> {
    this.newServiceCalled.push([requestedServiceId, codeHash, codeLength, gas, balance]);
    if (this.newServiceResponse !== null) {
      return Result.ok(this.newServiceResponse);
    }

    return Result.error("insufficient funds");
  }

  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void {
    this.upgradeData.push([codeHash, gas, allowance]);
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
