import type { CodeHash, CoreIndex, PerValidator, ServiceGas, ServiceId } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { ValidatorData } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import {
  type PartialState,
  type PreimageStatus,
  type QuitError,
  type RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state";

export class PartialStateMock implements PartialState {
  public readonly authQueue: Parameters<PartialStateMock["updateAuthorizationQueue"]>[] = [];
  public readonly forgetPreimageData: Parameters<PartialStateMock["forgetPreimage"]>[] = [];
  public readonly newServiceCalled: Parameters<PartialStateMock["newService"]>[] = [];
  public readonly privilegedServices: Parameters<PartialStateMock["updatePrivilegedServices"]>[] = [];
  public readonly quitAndTransferData: Parameters<PartialStateMock["quitAndTransfer"]>[] = [];
  public readonly requestPreimageData: Parameters<PartialStateMock["requestPreimage"]>[] = [];
  public readonly checkPreimageStatusData: Parameters<PartialStateMock["checkPreimageStatus"]>[] = [];
  public readonly transferData: Parameters<PartialStateMock["transfer"]>[] = [];
  public readonly upgradeData: Parameters<PartialStateMock["upgradeService"]>[] = [];
  public readonly validatorsData: Parameters<PartialStateMock["updateValidatorsData"]>[0][] = [];

  public checkpointCalled = 0;
  public yieldHash: OpaqueHash | null = null;
  public forgetPreimageResponse: Result<OK, null> = Result.ok(OK);
  public newServiceResponse: ServiceId | null = null;
  public quitAndBurnCalled = 0;
  public quitReturnValue: Result<OK, QuitError> = Result.ok(OK);
  public requestPreimageResponse: Result<OK, RequestPreimageError> = Result.ok(OK);
  public checkPreimageStatusResponse: PreimageStatus | null = null;
  public transferReturnValue: Result<OK, TransferError> = Result.ok(OK);

  quitAndTransfer(
    destination: ServiceId,
    suppliedGas: ServiceGas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, QuitError> {
    this.quitAndTransferData.push([destination, suppliedGas, memo]);
    return this.quitReturnValue;
  }

  quitAndBurn(): void {
    this.quitAndBurnCalled += 1;
  }

  checkPreimageStatus(hash: Blake2bHash, length: U64): PreimageStatus | null {
    this.checkPreimageStatusData.push([hash, length]);
    return this.checkPreimageStatusResponse;
  }

  requestPreimage(hash: Blake2bHash, length: U64): Result<OK, RequestPreimageError> {
    this.requestPreimageData.push([hash, length]);
    return this.requestPreimageResponse;
  }

  forgetPreimage(hash: Blake2bHash, length: U64): Result<OK, null> {
    this.forgetPreimageData.push([hash, length]);
    return this.forgetPreimageResponse;
  }

  transfer(
    destination: ServiceId | null,
    amount: U64,
    suppliedGas: ServiceGas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError> {
    if (destination === null) {
      return Result.error(TransferError.DestinationNotFound);
    }
    this.transferData.push([destination, amount, suppliedGas, memo]);
    return this.transferReturnValue;
  }

  newService(
    codeHash: CodeHash,
    codeLength: U32,
    gas: ServiceGas,
    balance: ServiceGas,
  ): Result<ServiceId, "insufficient funds"> {
    this.newServiceCalled.push([codeHash, codeLength, gas, balance]);
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

  updatePrivilegedServices(m: ServiceId, a: ServiceId, v: ServiceId, g: Map<ServiceId, ServiceGas>): void {
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
