import {
  type CodeHash,
  type CoreIndex,
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants";
import type { PreimageHash } from "@typeberry/block/preimage";
import type { Bytes } from "@typeberry/bytes";
import type { CodecRecord } from "@typeberry/codec";
import { type FixedSizeArray, HashDictionary, asKnownSize } from "@typeberry/collections";
import type { Blake2bHash, OpaqueHash } from "@typeberry/hash";
import { type U32, type U64, sumU32, sumU64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  LookupHistoryItem,
  Service,
  ServiceAccountInfo,
  type State,
  type ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { OK, Result, assertNever, check, ensure } from "@typeberry/utils";
import {
  type PartialState,
  type PreimageStatus,
  PreimageStatusKind,
  type QuitError,
  RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
  slotsToPreimageStatus,
} from "./partial-state";

/** `D`: https://graypaper.fluffylabs.dev/#/9a08063/445800445800?v=0.6.6 */
export const PREIMAGE_EXPUNGE_PERIOD = 19200;

export class PartialStateDb implements PartialState {
  // TODO [ToDr] consider getters?
  public readonly updatedState: StateUpdate = new StateUpdate();
  public checkpointedState: StateUpdate | null = null;

  constructor(
    private readonly state: State,
    /** `x_s` */
    private readonly currentServiceId: ServiceId,
    /** `x_i`: next service id we are going to create. */
    private nextNewServiceId: ServiceId,
  ) {
    const service = this.state.services.get(this.currentServiceId);
    if (service === undefined) {
      throw new Error(`Invalid state initialization. Service info missing for ${this.currentServiceId}.`);
    }
  }

  public getNextNewServiceId() {
    return this.nextNewServiceId;
  }

  private getCurrentServiceInfo(): ServiceAccountInfo {
    if (this.updatedState.updatedServiceInfo !== null) {
      return this.updatedState.updatedServiceInfo;
    }

    const maybeService = this.state.services.get(this.currentServiceId);
    const service = ensure<Service | undefined, Service>(
      maybeService,
      maybeService !== undefined,
      "Service existence in state validated in constructor.",
    );
    return service.data.info;
  }

  private getServiceInfo(destination: ServiceId | null): ServiceAccountInfo | null {
    if (destination === null) {
      return null;
    }

    if (destination === this.currentServiceId) {
      return this.getCurrentServiceInfo();
    }

    const isEjected = false; // TODO [ToDr] eject
    if (isEjected) {
      return null;
    }

    const maybeNewService = this.updatedState.newServices.find((x) => x.id === destination);
    if (maybeNewService !== undefined) {
      return maybeNewService.data.info;
    }

    const maybeService = this.state.services.get(destination);
    if (maybeService === undefined) {
      return null;
    }
    return maybeService.data.info;
  }

  private getPreimageStatus(hash: PreimageHash, length: U64): PreimageUpdate | undefined {
    const updatedPreimage = this.updatedState.preimages.find(
      (x) => x.hash.isEqualTo(hash) && BigInt(x.length) === length,
    );
    if (updatedPreimage !== undefined) {
      return updatedPreimage;
    }
    // fallback to state lookup
    const service = this.state.services.get(this.currentServiceId);
    const lookup = service?.data.lookupHistory.get(hash);
    const status = lookup?.find((x) => BigInt(x.length) === length);
    return status === undefined ? undefined : PreimageUpdate.update(status);
  }

  private updateOrAddPreimageUpdate(existingPreimage: PreimageUpdate, newUpdate: PreimageUpdate) {
    const index = this.updatedState.preimages.indexOf(existingPreimage);
    const removeCount = index === -1 ? 0 : 1;
    this.updatedState.preimages.splice(index, removeCount, newUpdate);
  }

  /** `check`: https://graypaper.fluffylabs.dev/#/9a08063/303f02303f02?v=0.6.6 */
  private getNextAvailableServiceId(serviceId: ServiceId): ServiceId {
    let currentServiceId = serviceId;
    const mod = 2 ** 32 - 2 ** 9;
    for (;;) {
      const service = this.getServiceInfo(currentServiceId);
      // we found an empty id
      if (service === null) {
        return currentServiceId;
      }
      // keep trying
      currentServiceId = tryAsServiceId(((currentServiceId - 2 ** 8 + 1 + mod) % mod) + 2 ** 8);
    }
  }

  checkPreimageStatus(hash: PreimageHash, length: U64): PreimageStatus | null {
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    const status = this.getPreimageStatus(hash, length);
    if (status === undefined || status.forgotten) {
      return null;
    }

    return slotsToPreimageStatus(status.slots);
  }

  requestPreimage(hash: PreimageHash, length: U64): Result<OK, RequestPreimageError> {
    const existingPreimage = this.getPreimageStatus(hash, length);

    if (existingPreimage !== undefined && !existingPreimage.forgotten) {
      const len = existingPreimage.slots.length;
      // https://graypaper.fluffylabs.dev/#/9a08063/380901380901?v=0.6.6
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
    // https://graypaper.fluffylabs.dev/#/9a08063/381201381601?v=0.6.6
    const serviceInfo = this.getCurrentServiceInfo();
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
    if (existingPreimage === undefined || existingPreimage.forgotten) {
      // https://graypaper.fluffylabs.dev/#/9a08063/38a60038a600?v=0.6.6
      this.updatedState.preimages.push(
        PreimageUpdate.update(new LookupHistoryItem(hash, len, tryAsLookupHistorySlots([]))),
      );
    } else {
      /** https://graypaper.fluffylabs.dev/#/9a08063/38ca0038ca00?v=0.6.6 */
      this.updateOrAddPreimageUpdate(
        existingPreimage,
        PreimageUpdate.update(
          new LookupHistoryItem(hash, len, tryAsLookupHistorySlots([...existingPreimage.slots, this.state.timeslot])),
        ),
      );
    }

    return Result.ok(OK);
  }

  forgetPreimage(hash: PreimageHash, length: U64): Result<OK, null> {
    const status = this.getPreimageStatus(hash, length);
    if (status === undefined || status.forgotten) {
      return Result.error(null);
    }

    const s = slotsToPreimageStatus(status.slots);
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    if (s.status === PreimageStatusKind.Requested) {
      this.updateOrAddPreimageUpdate(status, PreimageUpdate.forget(status));
      return Result.ok(OK);
    }

    const t = this.state.timeslot;
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    if (s.status === PreimageStatusKind.Unavailable) {
      const y = s.data[1];
      if (y < t - PREIMAGE_EXPUNGE_PERIOD) {
        this.updateOrAddPreimageUpdate(status, PreimageUpdate.forget(status));
        return Result.ok(OK);
      }

      return Result.error(null);
    }

    // https://graypaper.fluffylabs.dev/#/9a08063/38c80138c801?v=0.6.6
    if (s.status === PreimageStatusKind.Available) {
      this.updateOrAddPreimageUpdate(
        status,
        PreimageUpdate.update(
          new LookupHistoryItem(status.hash, status.length, tryAsLookupHistorySlots([s.data[0], t])),
        ),
      );
      return Result.ok(OK);
    }

    // https://graypaper.fluffylabs.dev/#/9a08063/38d00138d001?v=0.6.6
    if (s.status === PreimageStatusKind.Reavailable) {
      const y = s.data[1];
      if (y < t - PREIMAGE_EXPUNGE_PERIOD) {
        this.updateOrAddPreimageUpdate(
          status,
          PreimageUpdate.update(
            new LookupHistoryItem(status.hash, status.length, tryAsLookupHistorySlots([s.data[2], t])),
          ),
        );

        return Result.ok(OK);
      }

      return Result.error(null);
    }

    assertNever(s);
  }

  quitAndTransfer(
    _destination: ServiceId,
    _suppliedGas: ServiceGas,
    _memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, QuitError> {
    throw new Error("Method not implemented (waiting for eject)");
  }

  quitAndBurn(): void {
    throw new Error("Method not implemented (waiting for eject)");
  }

  transfer(
    destinationId: ServiceId | null,
    amount: U64,
    gas: ServiceGas,
    memo: Bytes<TRANSFER_MEMO_BYTES>,
  ): Result<OK, TransferError> {
    const source = this.getCurrentServiceInfo();
    const destination = this.getServiceInfo(destinationId);
    /** https://graypaper.fluffylabs.dev/#/9a08063/370401370401?v=0.6.6 */
    if (destination === null || destinationId === null) {
      return Result.error(TransferError.DestinationNotFound);
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/371301371301?v=0.6.6 */
    if (gas < destination.onTransferMinGas) {
      return Result.error(TransferError.GasTooLow);
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/371b01371b01?v=0.6.6 */
    const newBalance = source.balance - amount;
    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      source.storageUtilisationCount,
      source.storageUtilisationBytes,
    );
    if (newBalance < thresholdBalance) {
      return Result.error(TransferError.BalanceBelowThreshold);
    }

    // outgoing transfer
    this.updatedState.transfers.push(
      PendingTransfer.create({
        source: this.currentServiceId,
        destination: destinationId,
        amount,
        memo,
        gas,
      }),
    );

    // reduced balance
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.fromCodec({
      ...source,
      balance: tryAsU64(newBalance),
    });
    return Result.ok(OK);
  }

  newService(
    codeHash: CodeHash,
    codeLength: U32,
    accumulateMinGas: ServiceGas,
    onTransferMinGas: ServiceGas,
  ): Result<ServiceId, "insufficient funds"> {
    const newServiceId = this.nextNewServiceId;
    // calculate the threshold. Storage is empty, one preimage requested.
    // https://graypaper.fluffylabs.dev/#/9a08063/114501114501?v=0.6.6
    const items = tryAsU32(2 * 1 + 0);
    const bytes = tryAsU64(81 + codeLength);

    const thresholdForNew = ServiceAccountInfo.calculateThresholdBalance(items, bytes);
    const currentService = this.getCurrentServiceInfo();
    const thresholdForCurrent = ServiceAccountInfo.calculateThresholdBalance(
      currentService.storageUtilisationCount,
      currentService.storageUtilisationBytes,
    );

    // check if we have enough balance
    const balanceLeftForCurrent = currentService.balance - thresholdForNew;
    if (balanceLeftForCurrent < thresholdForCurrent) {
      return Result.error("insufficient funds");
    }

    // proceed with service creation
    const newService = new Service(newServiceId, {
      info: ServiceAccountInfo.fromCodec({
        codeHash,
        balance: thresholdForNew,
        accumulateMinGas,
        onTransferMinGas,
        storageUtilisationBytes: bytes,
        storageUtilisationCount: items,
      }),
      preimages: HashDictionary.new(),
      lookupHistory: HashDictionary.new(),
      storage: [],
    });
    // add the preimage request
    newService.data.lookupHistory.set(codeHash.asOpaque(), [
      new LookupHistoryItem(codeHash.asOpaque(), codeLength, tryAsLookupHistorySlots([])),
    ]);

    // add the new service
    this.updatedState.newServices.push(newService);

    // update the balance
    // https://graypaper.fluffylabs.dev/#/9a08063/36f10236f102?v=0.6.6
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.fromCodec({
      ...currentService,
      balance: tryAsU64(balanceLeftForCurrent),
    });

    // update the next service id we are going to create next
    // https://graypaper.fluffylabs.dev/#/9a08063/363603363603?v=0.6.6
    this.nextNewServiceId = this.getNextAvailableServiceId(bumpServiceId(newServiceId));

    return Result.ok(newServiceId);
  }

  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/36c80336c803?v=0.6.6 */
    const serviceInfo = this.getCurrentServiceInfo();
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.fromCodec({
      ...serviceInfo,
      codeHash,
      accumulateMinGas: tryAsServiceGas(gas),
      onTransferMinGas: tryAsServiceGas(allowance),
    });
  }

  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/36e10136e901?v=0.6.6 */
    this.updatedState.validatorsData = validatorsData;
  }

  checkpoint(): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/362202362202?v=0.6.6 */
    this.checkpointedState = StateUpdate.copyFrom(this.updatedState);
  }

  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>,
  ): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/368401368401?v=0.6.6 */
    // NOTE `coreIndex` is already verified in the HC, so this is infallible.
    this.updatedState.authorizationQueues.set(coreIndex, authQueue);
  }

  updatePrivilegedServices(
    manager: ServiceId,
    authorizer: ServiceId,
    validators: ServiceId,
    autoAccumulate: Map<ServiceId, ServiceGas>,
  ): void {
    // TODO [ToDr] Not sure if we should fail this if the services don't exist?
    /** https://graypaper.fluffylabs.dev/#/9a08063/36f40036f400?v=0.6.6 */
    this.updatedState.priviledgedServices = {
      manager,
      authorizer,
      validators,
      autoAccumulate,
    };
  }

  yield(hash: OpaqueHash): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/387d02387d02?v=0.6.6 */
    this.updatedState.yieldedRoot = hash;
  }
}

export class PreimageUpdate extends LookupHistoryItem {
  private constructor(
    item: LookupHistoryItem,
    /** NOTE: Forgotten preimages should be removed along their lookup history. */
    public forgotten: boolean,
  ) {
    super(item.hash, item.length, item.slots);
  }

  static forget(item: LookupHistoryItem) {
    return new PreimageUpdate(item, true);
  }

  static update(item: LookupHistoryItem) {
    return new PreimageUpdate(item, false);
  }
}

export class PendingTransfer {
  private constructor(
    public readonly source: ServiceId,
    public readonly destination: ServiceId,
    public readonly amount: U64,
    public readonly memo: Bytes<TRANSFER_MEMO_BYTES>,
    public readonly gas: ServiceGas,
  ) {}

  static create(x: CodecRecord<PendingTransfer>) {
    return new PendingTransfer(x.source, x.destination, x.amount, x.memo, x.gas);
  }
}

export class StateUpdate {
  static copyFrom(from: StateUpdate): StateUpdate {
    const update = new StateUpdate();
    update.newServices.push(...from.newServices);
    update.transfers.push(...from.transfers);
    update.preimages.push(...from.preimages);
    for (const [k, v] of from.authorizationQueues) {
      update.authorizationQueues.set(k, v);
    }

    update.updatedServiceInfo =
      from.updatedServiceInfo === null ? null : ServiceAccountInfo.fromCodec(from.updatedServiceInfo);
    update.validatorsData = from.validatorsData === null ? null : asKnownSize([...from.validatorsData]);
    update.yieldedRoot = from.yieldedRoot;
    update.priviledgedServices =
      from.priviledgedServices === null
        ? null
        : {
            ...from.priviledgedServices,
          };

    return update;
  }

  public readonly newServices: Service[] = [];
  public readonly transfers: PendingTransfer[] = [];
  public readonly preimages: PreimageUpdate[] = [];
  public readonly authorizationQueues: Map<CoreIndex, FixedSizeArray<Blake2bHash, AUTHORIZATION_QUEUE_SIZE>> =
    new Map();

  public updatedServiceInfo: ServiceAccountInfo | null = null;
  public validatorsData: PerValidator<ValidatorData> | null = null;
  public yieldedRoot: OpaqueHash | null = null;
  public priviledgedServices: {
    manager: ServiceId;
    authorizer: ServiceId;
    validators: ServiceId;
    autoAccumulate: Map<ServiceId, ServiceGas>;
  } | null = null;
}

function bumpServiceId(serviceId: ServiceId) {
  const mod = 2 ** 32 - 2 ** 9;
  return tryAsServiceId(2 ** 8 + ((serviceId - 2 ** 8 + 42 + mod) % mod));
}
