import type { CoreIndex, ServiceId } from "@typeberry/block";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash } from "@typeberry/hash";
import type { Gas } from "@typeberry/pvm-interpreter/gas";
import type { AUTHORIZATION_QUEUE_SIZE, AccumulationPartialState } from "./partial-state";

export class TestAccumulate implements AccumulationPartialState {
  public readonly privilegedServices: Parameters<TestAccumulate["updatePrivilegedServices"]>[] = [];
  public readonly authQueue: Parameters<TestAccumulate["updateAuthorizationQueue"]>[] = [];

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
