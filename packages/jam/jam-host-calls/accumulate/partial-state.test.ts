import type { CodeHash, CoreIndex, PerValidator, ServiceId } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import {
  type AccumulationPartialState,
  type PreimageStatusResult,
  type QuitError,
  type RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];
  public readonly forgetPreimageData: Parameters<TestAccumulate["forgetPreimage"]>[] = [];
  public readonly newServiceCalled: Parameters<TestAccumulate["newService"]>[] = [];
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly quitAndTransferData: Parameters<TestAccumulate["quitAndTransfer"]>[] = [];
  public readonly requestPreimageData: Parameters<TestAccumulate["requestPreimage"]>[] = [];
  public readonly checkPreimageStatusData: Parameters<TestAccumulate["checkPreimageStatus"]>[] = [];
  public readonly transferData: Parameters<TestAccumulate["transfer"]>[] = [];
  public readonly upgradeData: Parameters<TestAccumulate["upgradeService"]>[] = [];
  public readonly validatorsData: Parameters<TestAccumulate["updateValidatorsData"]>[0][] = [];

  public checkpointCalled = 0;
  public yieldHash: OpaqueHash | null = null;
  public forgetPreimageResponse: Result<null, null> = Result.ok(null);
  public newServiceResponse: ServiceId | null = null;
  public quitAndBurnCalled = 0;
  public quitReturnValue: Result<null, QuitError> = Result.ok(null);
  public requestPreimageResponse: Result<null, RequestPreimageError> = Result.ok(null);
  public checkPreimageStatusResponse: PreimageStatusResult | null = null;
  public transferReturnValue: Result<OK, TransferError> = Result.ok(OK);

  quitAndTransfer(destination: ServiceId, suppliedGas: Gas, memo: Bytes<TRANSFER_MEMO_BYTES>): Result<null, QuitError> {
    this.quitAndTransferData.push([destination, suppliedGas, memo]);
    return this.quitReturnValue;
  }

  quitAndBurn(): void {
    this.quitAndBurnCalled += 1;
  }

  checkPreimageStatus(hash: Blake2bHash, length: U64): PreimageStatusResult | null {
    this.checkPreimageStatusData.push([hash, length]);
    return this.checkPreimageStatusResponse;
  }

  requestPreimage(hash: Blake2bHash, length: U64): Result<null, RequestPreimageError> {
    this.requestPreimageData.push([hash, length]);
    return this.requestPreimageResponse;
  }

  forgetPreimage(hash: Blake2bHash, length: U64): Result<null, null> {
    this.forgetPreimageData.push([hash, length]);
    return this.forgetPreimageResponse;
  }

  transfer(
    destination: ServiceId | null,
    amount: U64,
    suppliedGas: Gas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError> {
    if (destination === null) {
      return Result.error(TransferError.DestinationNotFound);
    }
    this.transferData.push([destination, amount, suppliedGas, memo]);
    return this.transferReturnValue;
  }

  newService(
    requestedServiceId: ServiceId,
    codeHash: CodeHash,
    codeLength: U64,
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

  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): void {
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

  yield(hash: OpaqueHash): void {
    this.yieldHash = hash;
  }
}
