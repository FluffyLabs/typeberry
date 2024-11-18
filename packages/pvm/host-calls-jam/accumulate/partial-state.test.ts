import type { CodeHash, CoreIndex, ServiceId } from "@typeberry/block";
import type { FixedSizeArray, KnownSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import type { U32, U64 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { ValidatorData } from "@typeberry/safrole";
import { Result } from "@typeberry/utils";
import type { AUTHORIZATION_QUEUE_SIZE, AccumulationPartialState, RequestPreimageError } from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];
  public readonly validatorsData: Parameters<TestAccumulate["updateValidatorsData"]>[0][] = [];
  public readonly newServiceCalled: Parameters<TestAccumulate["newService"]>[] = [];
  public readonly requestPreimageData: Parameters<TestAccumulate["requestPreimage"]>[] = [];

  public newServiceResponse: ServiceId | null = null;
  public requestPreimageResponse: Result<null, RequestPreimageError> = Result.ok(null);
  public checkpointCalled = 0;

  requestPreimage(hash: OpaqueHash, length: U32): Result<null, RequestPreimageError> {
    this.requestPreimageData.push([hash, length]);
    return this.requestPreimageResponse;
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
