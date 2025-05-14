import type { CodeHash, CoreIndex, PerValidator, ServiceId } from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { Bytes } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import { type U32, type U64, sumU32, sumU64, tryAsU32 } from "@typeberry/numbers";
import type { Gas } from "@typeberry/pvm-interpreter";
import {
  LookupHistoryItem,
  ServiceAccountInfo,
  type State,
  type ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { type OK, Result, check } from "@typeberry/utils";
import {
  type PartialState,
  type PreimageStatus,
  PreimageStatusKind,
  type QuitError,
  RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  type TransferError,
  slotsToPreimageStatus,
} from "./partial-state";

class StateUpdate {
  static copyFrom(from: StateUpdate): StateUpdate {
    const update = new StateUpdate();
    update.lookupHistory.push(...from.lookupHistory);
    update.updatedServiceInfo =
      from.updatedServiceInfo === null ? null : ServiceAccountInfo.fromCodec(from.updatedServiceInfo);
    return update;
  }

  public readonly lookupHistory: LookupHistoryItem[] = [];
  public updatedServiceInfo: ServiceAccountInfo | null = null;
}

export class PartialStateDb implements PartialState {
  // TODO [ToDr] consider getters?
  public readonly updatedState: StateUpdate = new StateUpdate();
  public checkpointedState: StateUpdate | null = null;

  constructor(
    private readonly state: State,
    // TODO [ToDr] current service id should be an argument to functions instead.
    private readonly currentServiceId: ServiceId,
  ) {}

  private getServiceInfo(): ServiceAccountInfo {
    if (this.updatedState.updatedServiceInfo !== null) {
      return this.updatedState.updatedServiceInfo;
    }

    const service = this.state.services.get(this.currentServiceId);
    if (service === undefined) {
      throw new Error(`Invalid state initialization. Service info missing for ${this.currentServiceId}.`);
    }

    return service.data.info;
  }

  private getPreimageStatus(hash: PreimageHash, length: U64): LookupHistoryItem | undefined {
    const updatedPreimage = this.updatedState.lookupHistory.find(
      (x) => x.hash.isEqualTo(hash) && BigInt(x.length) === length,
    );
    if (updatedPreimage !== undefined) {
      return updatedPreimage;
    }
    // fallback to state lookup
    const service = this.state.services.get(this.currentServiceId);
    const lookup = service?.data.lookupHistory.get(hash);
    const status = lookup?.find((x) => BigInt(x.length) === length);
    return status;
  }

  checkPreimageStatus(hash: PreimageHash, length: U64): PreimageStatus | null {
    const status = this.getPreimageStatus(hash, length);
    if (status === undefined) {
      return null;
    }

    return slotsToPreimageStatus(status.slots);
  }

  requestPreimage(hash: PreimageHash, length: U64): Result<null, RequestPreimageError> {
    const existingPreimage = this.getPreimageStatus(hash, length);

    if (existingPreimage !== undefined) {
      const len = existingPreimage.slots.length;
      if (len === PreimageStatusKind.Requested) {
        return Result.error(RequestPreimageError.AlreadyRequested);
      }
      if (len === PreimageStatusKind.Available || len === PreimageStatusKind.Reavailable) {
        return Result.error(RequestPreimageError.AlreadyAvailable);
      }

      // TODO [ToDr] Not sure if we should update the service info in that case,
      // but for now we let that case fall-through.
      check(len === PreimageStatusKind.Unavailable);
    }

    // make sure we have enough balance for this update
    const serviceInfo = this.getServiceInfo();
    const items = sumU32(serviceInfo.storageUtilisationCount, tryAsU32(1));
    const bytes = sumU64(serviceInfo.storageUtilisationBytes, length);

    // TODO [ToDr] this is not specified in GP, but it seems sensible.
    if (items.overflow || bytes.overflow) {
      return Result.error(RequestPreimageError.InsufficientFunds);
    }

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(items.value, bytes.value);
    if (serviceInfo.balance < thresholdBalance) {
      return Result.error(RequestPreimageError.InsufficientFunds);
    }

    // Update service info with new details.
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.fromCodec({
      ...serviceInfo,
      storageUtilisationBytes: bytes.value,
      storageUtilisationCount: items.value,
    });

    // and now update preimages

    // TODO [ToDr] This is probably invalid. What if someome requests the same
    // hash with two different lengths over `2**32`? We will end up with the same entry.
    // hopefuly this will be prohibitevely expensive?
    const len = length >= 2n ** 32n ? tryAsU32(2 ** 32 - 1) : tryAsU32(Number(length));
    if (existingPreimage === undefined) {
      this.updatedState.lookupHistory.push(new LookupHistoryItem(hash, len, tryAsLookupHistorySlots([])));
    } else {
      const index = this.updatedState.lookupHistory.indexOf(existingPreimage);
      const removeCount = index === -1 ? 0 : 1;
      this.updatedState.lookupHistory.splice(
        index,
        removeCount,
        new LookupHistoryItem(hash, len, tryAsLookupHistorySlots([...existingPreimage.slots, this.state.timeslot])),
      );
    }

    return Result.ok(null);
  }

  forgetPreimage(_hash: PreimageHash, _length: U64): Result<null, null> {
    throw new Error("Method not implemented.");
  }

  quitAndTransfer(
    _destination: ServiceId,
    _suppliedGas: Gas,
    _memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<null, QuitError> {
    throw new Error("Method not implemented.");
  }

  quitAndBurn(): void {
    throw new Error("Method not implemented.");
  }

  transfer(
    _destination: ServiceId | null,
    _amount: U64,
    _suppliedGas: Gas,
    _memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError> {
    throw new Error("Method not implemented.");
  }

  newService(
    _requestedServiceId: ServiceId,
    _codeHash: CodeHash,
    _codeLength: U32,
    _gas: U64,
    _balance: U64,
  ): Result<ServiceId, "insufficient funds"> {
    throw new Error("Method not implemented.");
  }

  upgradeService(_codeHash: CodeHash, _gas: U64, _allowance: U64): void {
    throw new Error("Method not implemented.");
  }

  updateValidatorsData(_validatorsData: PerValidator<ValidatorData>): void {
    throw new Error("Method not implemented.");
  }

  checkpoint(): void {
    this.checkpointedState = StateUpdate.copyFrom(this.updatedState);
  }

  updateAuthorizationQueue(
    _coreIndex: CoreIndex,
    _authQueue: FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>,
  ): void {
    throw new Error("Method not implemented.");
  }

  updatePrivilegedServices(_m: ServiceId, _a: ServiceId, _v: ServiceId, _g: Map<ServiceId, Gas>): void {
    throw new Error("Method not implemented.");
  }

  yield(_hash: OpaqueHash): void {
    throw new Error("Method not implemented.");
  }
}
