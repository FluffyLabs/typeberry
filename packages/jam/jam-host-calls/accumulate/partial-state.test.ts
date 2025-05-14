import type { CodeHash, CoreIndex, PerValidator, ServiceId } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import { type U64, tryAsU64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import { ServiceAccountInfo, type ValidatorData } from "@typeberry/state";
import { OK, Result } from "@typeberry/utils";
import {
  type AccumulationPartialState,
  EjectError,
  type PreimageStatusResult,
  type RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
} from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];
  public readonly forgetPreimageData: Parameters<TestAccumulate["forgetPreimage"]>[] = [];
  public readonly newServiceCalled: Parameters<TestAccumulate["newService"]>[] = [];
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly requestPreimageData: Parameters<TestAccumulate["requestPreimage"]>[] = [];
  public readonly checkPreimageStatusData: Parameters<TestAccumulate["checkPreimageStatus"]>[] = [];
  public readonly transferData: Parameters<TestAccumulate["transfer"]>[] = [];
  public readonly upgradeData: Parameters<TestAccumulate["upgradeService"]>[] = [];
  public readonly validatorsData: Parameters<TestAccumulate["updateValidatorsData"]>[0][] = [];

  public readonly services = new Map<ServiceId, ServiceAccountInfo>();

  public checkpointCalled = 0;
  public yieldHash: OpaqueHash | null = null;
  public forgetPreimageResponse: Result<null, null> = Result.ok(null);
  public newServiceResponse: ServiceId | null = null;
  public ejectReturnValue: Result<null, EjectError> = Result.ok(null);
  public requestPreimageResponse: Result<null, RequestPreimageError> = Result.ok(null);
  public checkPreimageStatusResponse: PreimageStatusResult | null = null;
  public transferReturnValue: Result<OK, TransferError> = Result.ok(OK);

  getService(serviceId: ServiceId | null): Promise<ServiceAccountInfo | null> {
    if (serviceId === null) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.services.get(serviceId) ?? null);
  }

  async eject(
    source: ServiceId | null,
    destination: ServiceId | null,
    _hash: Blake2bHash, // used for checking preimage availability
    _length: U64, // used for checking preimage availability
  ): Promise<Result<null, EjectError>> {
    const sourceService = await this.getService(source);
    const destinationService = await this.getService(destination);
    if (source === null || sourceService === null || destination === null || destinationService === null) {
      this.ejectReturnValue = Result.error(EjectError.DestinationNotFound);
      return Promise.resolve(this.ejectReturnValue);
    }
    if (source === destination) {
      this.ejectReturnValue = Result.error(EjectError.SameSourceAndDestination);
      return Promise.resolve(this.ejectReturnValue);
    }

    // update the destination service with the source service balance
    this.services.set(
      destination,
      ServiceAccountInfo.fromCodec({
        ...destinationService,
        balance: tryAsU64(destinationService.balance + sourceService.balance),
      }),
    );

    // remove the source service
    this.services.delete(source);
    return Promise.resolve(this.ejectReturnValue);
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
