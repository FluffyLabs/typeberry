import {
  type CodeHash,
  type CoreIndex,
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  tryAsServiceId,
} from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { Bytes, BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U64 } from "@typeberry/numbers";
import type { PerCore, ValidatorData } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import {
  type EjectError,
  type NewServiceError,
  type PartialState,
  type PreimageStatus,
  ProvidePreimageError,
  type RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
  type UnprivilegedError,
} from "./partial-state.js";

export class PartialStateMock implements PartialState {
  public readonly authQueue: Parameters<PartialStateMock["updateAuthorizationQueue"]>[] = [];
  public readonly forgetPreimageData: Parameters<PartialStateMock["forgetPreimage"]>[] = [];
  public readonly newServiceCalled: Parameters<PartialStateMock["newService"]>[] = [];
  public readonly privilegedServices: Parameters<PartialStateMock["updatePrivilegedServices"]>[] = [];
  public readonly ejectData: Parameters<PartialStateMock["eject"]>[] = [];
  public readonly requestPreimageData: Parameters<PartialStateMock["requestPreimage"]>[] = [];
  public readonly checkPreimageStatusData: Parameters<PartialStateMock["checkPreimageStatus"]>[] = [];
  public readonly transferData: Parameters<PartialStateMock["transfer"]>[] = [];
  public readonly upgradeData: Parameters<PartialStateMock["upgradeService"]>[] = [];
  public readonly validatorsData: Parameters<PartialStateMock["updateValidatorsData"]>[0][] = [];
  public readonly providePreimageData: Parameters<PartialStateMock["providePreimage"]>[] = [];

  public checkpointCalled = 0;
  public yieldHash: OpaqueHash | null = null;
  public forgetPreimageResponse: Result<OK, null> = Result.ok(OK);
  public newServiceResponse: Result<ServiceId, NewServiceError> = Result.ok(tryAsServiceId(0));
  public ejectReturnValue: Result<OK, EjectError> = Result.ok(OK);
  public requestPreimageResponse: Result<OK, RequestPreimageError> = Result.ok(OK);
  public checkPreimageStatusResponse: PreimageStatus | null = null;
  public transferReturnValue: Result<OK, TransferError> = Result.ok(OK);
  public validatorDataResponse: Result<OK, UnprivilegedError> = Result.ok(OK);
  public providePreimageResponse: Result<OK, ProvidePreimageError> = Result.ok(OK);

  eject(from: ServiceId | null, previousCode: PreimageHash): Result<OK, EjectError> {
    this.ejectData.push([from, previousCode]);
    return this.ejectReturnValue;
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
    codeLength: U64,
    gas: ServiceGas,
    balance: ServiceGas,
    gratisStorage: U64,
  ): Result<ServiceId, NewServiceError> {
    this.newServiceCalled.push([codeHash, codeLength, gas, balance, gratisStorage]);
    return this.newServiceResponse;
  }

  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void {
    this.upgradeData.push([codeHash, gas, allowance]);
  }

  checkpoint(): void {
    this.checkpointCalled += 1;
  }

  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): Result<OK, UnprivilegedError> {
    if (this.validatorDataResponse.isOk) {
      this.validatorsData.push(validatorsData);
    }
    return this.validatorDataResponse;
  }

  updatePrivilegedServices(m: ServiceId, a: PerCore<ServiceId>, v: ServiceId, g: [ServiceId, ServiceGas][]): void {
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

  providePreimage(service: ServiceId | null, preimage: BytesBlob): Result<OK, ProvidePreimageError> {
    if (service === null) {
      return Result.error(ProvidePreimageError.ServiceNotFound);
    }
    this.providePreimageData.push([service, preimage]);
    return this.providePreimageResponse;
  }
}
