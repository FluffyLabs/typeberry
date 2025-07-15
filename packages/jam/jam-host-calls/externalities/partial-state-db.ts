import {
  type CodeHash,
  type CoreIndex,
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  tryAsServiceGas,
  tryAsServiceId,
} from "@typeberry/block";
import type { AUTHORIZATION_QUEUE_SIZE } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash } from "@typeberry/block/work-report.js";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import { type FixedSizeArray, HashDictionary } from "@typeberry/collections";
import { HASH_SIZE, type OpaqueHash, blake2b } from "@typeberry/hash";
import { type U32, type U64, isU32, isU64, maxU64, sumU32, sumU64, tryAsU32, tryAsU64 } from "@typeberry/numbers";
import {
  InMemoryService,
  LookupHistoryItem,
  PreimageItem,
  type Service,
  ServiceAccountInfo,
  type State,
  StorageItem,
  type StorageKey,
  UpdateStorage,
  type ValidatorData,
  tryAsLookupHistorySlots,
} from "@typeberry/state";
import { OK, Result, assertNever, check, ensure } from "@typeberry/utils";
import type { AccountsInfo } from "../info.js";
import type { AccountsLookup } from "../lookup.js";
import type { AccountsRead } from "../read.js";
import { clampU64ToU32, writeServiceIdAsLeBytes } from "../utils.js";
import type { AccountsWrite } from "../write.js";
import {
  EjectError,
  type PartialState,
  type PreimageStatus,
  PreimageStatusKind,
  ProvidePreimageError,
  RequestPreimageError,
  type TRANSFER_MEMO_BYTES,
  TransferError,
  slotsToPreimageStatus,
} from "./partial-state.js";
import { PendingTransfer } from "./pending-transfer.js";
import { AccumulationStateUpdate, NewPreimage, PreimageUpdate } from "./state-update.js";

/**
 * `D`: Period in timeslots after which an unreferenced preimage may be expunged.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/445800445800?v=0.6.6
 */
export const PREIMAGE_EXPUNGE_PERIOD = 19200;

/**
 * Number of storage items required for ejection of the service.
 *
 * Value 2 seems to indicate that there is only one preimage lookup,
 * and it has to be the previous code of the service, additionally used
 * to authorize the `eject`.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/370202370502?v=0.6.6 */
const REQUIRED_NUMBER_OF_STORAGE_ITEMS_FOR_EJECT = 2;

type StateSlice = Pick<State, "getService" | "timeslot">;

export class PartialStateDb implements PartialState, AccountsWrite, AccountsRead, AccountsInfo, AccountsLookup {
  public readonly updatedState: AccumulationStateUpdate;
  private checkpointedState: AccumulationStateUpdate | null = null;
  /** `x_i`: next service id we are going to create. */
  private nextNewServiceId: ServiceId;

  constructor(
    private readonly state: StateSlice,
    /** `x_s` */
    private readonly currentServiceId: ServiceId,
    nextNewServiceIdCandidate: ServiceId,
  ) {
    this.updatedState = new AccumulationStateUpdate(currentServiceId);
    this.nextNewServiceId = this.getNextAvailableServiceId(nextNewServiceIdCandidate);

    const service = this.state.getService(this.currentServiceId);
    if (service === null) {
      throw new Error(`Invalid state initialization. Service info missing for ${this.currentServiceId}.`);
    }
  }

  /** Return the underlying state update and checkpointed state (if any). */
  getStateUpdates(): [AccumulationStateUpdate, AccumulationStateUpdate | null] {
    return [this.updatedState, this.checkpointedState];
  }

  /** Return current `x_i` value of next new service id. */
  getNextNewServiceId() {
    return this.nextNewServiceId;
  }

  /**
   * Retrieve service info of currently accumulating service.
   *
   * Takes into account updates over the state.
   */
  private getCurrentServiceInfo(): ServiceAccountInfo {
    if (this.updatedState.updatedServiceInfo !== null) {
      return this.updatedState.updatedServiceInfo;
    }

    const maybeService = this.state.getService(this.currentServiceId);
    const service = ensure<Service | null, Service>(
      maybeService,
      maybeService !== null,
      "Service existence in state validated in constructor.",
    );
    return service.getInfo();
  }

  /**
   * Retrieve info of service with given id.
   *
   * NOTE the info may be updated compared to what is in the state.
   *
   * Takes into account newly created services as well.
   */
  getServiceInfo(destination: ServiceId | null): ServiceAccountInfo | null {
    if (destination === null) {
      return null;
    }

    if (destination === this.currentServiceId) {
      return this.getCurrentServiceInfo();
    }

    const isEjected = this.updatedState.ejectedServices.some((x) => x === destination);
    if (isEjected) {
      return null;
    }

    const maybeNewService = this.updatedState.newServices.find(({ serviceId }) => serviceId === destination);
    if (maybeNewService !== undefined) {
      return maybeNewService.data.info;
    }

    const maybeService = this.state.getService(destination);
    if (maybeService === null) {
      return null;
    }

    return maybeService.getInfo();
  }

  /** Get status of a preimage of current service taking into account any updates. */
  private getPreimageStatus(hash: PreimageHash, length: U64): PreimageUpdate | null {
    const updatedPreimage = this.updatedState.lookupHistory.find(
      (preimage) => preimage.hash.isEqualTo(hash) && BigInt(preimage.length) === length,
    );
    if (updatedPreimage !== undefined) {
      return updatedPreimage;
    }

    // fallback to state lookup
    const service = this.state.getService(this.currentServiceId);
    const lenU32 = preimageLenAsU32(length);
    if (lenU32 === null || service === null) {
      return null;
    }

    const slots = service.getLookupHistory(hash, lenU32);
    return slots === null ? null : PreimageUpdate.update(new LookupHistoryItem(hash, lenU32, slots));
  }

  /**
   * Returns `true` if given service has a particular preimage unavailable
   * and expired.
   *
   * Note that we only check the state here, since the function is used
   * in the context of `eject` function.
   *
   * There is one way that previousCode is in the recently updated state
   * - cannot be part of the newly created service, because
   *   the preimage would not be available yet.
   * - cannot be "freshly provided", since we defer updating the
   *   lookup status.
   */
  private isPreviousCodeExpired(destination: ServiceId, previousCodeHash: PreimageHash, len: U64): [boolean, string] {
    const service = this.state.getService(destination);
    const lenU32 = preimageLenAsU32(len);
    const slots = service === null || lenU32 === null ? null : service.getLookupHistory(previousCodeHash, lenU32);
    const status = slots === null ? null : slotsToPreimageStatus(slots);
    // The previous code needs to be forgotten and expired.
    if (status?.status !== PreimageStatusKind.Unavailable) {
      return [false, "wrong status"];
    }
    const t = this.state.timeslot;
    const isExpired = status.data[1] < t - PREIMAGE_EXPUNGE_PERIOD;
    return [isExpired, isExpired ? "" : "not expired"];
  }

  /**
   * Returns `true` if the preimage is already provided either in current
   * accumulation scope or earlier.
   *
   * NOTE: Does not check if the preimage is available, we just check
   * the existence in `preimages` map.
   */
  private hasExistingPreimage(serviceId: ServiceId | null, hash: PreimageHash): boolean {
    if (serviceId === null) {
      return false;
    }

    const providedPreimage = this.updatedState.providedPreimages.find(
      (p) => p.serviceId === serviceId && p.item.hash.isEqualTo(hash),
    );
    if (providedPreimage !== undefined) {
      return true;
    }

    // fallback to state preimages
    const service = this.state.getService(serviceId);
    if (service === undefined) {
      return false;
    }

    return service?.hasPreimage(hash) ?? false;
  }

  /**
   * Update a preimage.
   *
   * May replace an existing entry in the pending state update.
   */
  private replaceOrAddPreimageUpdate(existingPreimage: PreimageUpdate, newUpdate: PreimageUpdate) {
    const index = this.updatedState.lookupHistory.indexOf(existingPreimage);
    const removeCount = index === -1 ? 0 : 1;
    this.updatedState.lookupHistory.splice(index, removeCount, newUpdate);
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
    if (status === null || status.forgotten) {
      return null;
    }

    return slotsToPreimageStatus(status.slots);
  }

  requestPreimage(hash: PreimageHash, length: U64): Result<OK, RequestPreimageError> {
    const existingPreimage = this.getPreimageStatus(hash, length);

    if (existingPreimage !== null && !existingPreimage.forgotten) {
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

    const res = this.updateServiceStorageUtilisation(items, bytes, serviceInfo);
    if (res.isError) {
      return Result.error(RequestPreimageError.InsufficientFunds, res.details);
    }

    // and now update preimages

    // TODO [ToDr] This is probably invalid. What if someome requests the same
    // hash with two different lengths over `2**32`? We will end up with the same entry.
    // hopefuly this will be prohibitevely expensive?
    const clampedLength = clampU64ToU32(length);
    if (existingPreimage === null || existingPreimage.forgotten) {
      // https://graypaper.fluffylabs.dev/#/9a08063/38a60038a600?v=0.6.6
      this.updatedState.lookupHistory.push(
        PreimageUpdate.update(new LookupHistoryItem(hash, clampedLength, tryAsLookupHistorySlots([]))),
      );
    } else {
      /** https://graypaper.fluffylabs.dev/#/9a08063/38ca0038ca00?v=0.6.6 */
      this.replaceOrAddPreimageUpdate(
        existingPreimage,
        PreimageUpdate.update(
          new LookupHistoryItem(
            hash,
            clampedLength,
            tryAsLookupHistorySlots([...existingPreimage.slots, this.state.timeslot]),
          ),
        ),
      );
    }

    return Result.ok(OK);
  }

  updateServiceStorageUtilisation(
    items: { overflow: boolean; value: U32 },
    bytes: { overflow: boolean; value: U64 },
    serviceInfo: ServiceAccountInfo,
  ): Result<OK, "insufficient funds"> {
    // TODO [ToDr] this is not specified in GP, but it seems sensible.
    if (items.overflow || bytes.overflow) {
      return Result.error("insufficient funds");
    }

    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(items.value, bytes.value);
    if (serviceInfo.balance < thresholdBalance) {
      return Result.error("insufficient funds");
    }

    // Update service info with new details.
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.create({
      ...serviceInfo,
      storageUtilisationBytes: bytes.value,
      storageUtilisationCount: items.value,
    });

    return Result.ok(OK);
  }

  forgetPreimage(hash: PreimageHash, length: U64): Result<OK, null> {
    const status = this.getPreimageStatus(hash, length);
    if (status === null || status.forgotten) {
      return Result.error(null);
    }

    const s = slotsToPreimageStatus(status.slots);
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    if (s.status === PreimageStatusKind.Requested) {
      this.replaceOrAddPreimageUpdate(status, PreimageUpdate.forget(status));
      return Result.ok(OK);
    }

    const t = this.state.timeslot;
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    if (s.status === PreimageStatusKind.Unavailable) {
      const y = s.data[1];
      if (y < t - PREIMAGE_EXPUNGE_PERIOD) {
        this.replaceOrAddPreimageUpdate(status, PreimageUpdate.forget(status));
        return Result.ok(OK);
      }

      return Result.error(null);
    }

    // https://graypaper.fluffylabs.dev/#/9a08063/38c80138c801?v=0.6.6
    if (s.status === PreimageStatusKind.Available) {
      this.replaceOrAddPreimageUpdate(
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
        this.replaceOrAddPreimageUpdate(
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
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.create({
      ...source,
      balance: tryAsU64(newBalance),
    });
    return Result.ok(OK);
  }

  newService(
    codeHash: CodeHash,
    codeLength: U64,
    accumulateMinGas: ServiceGas,
    onTransferMinGas: ServiceGas,
  ): Result<ServiceId, "insufficient funds"> {
    const newServiceId = this.nextNewServiceId;
    // calculate the threshold. Storage is empty, one preimage requested.
    // https://graypaper.fluffylabs.dev/#/9a08063/114501114501?v=0.6.6
    const items = tryAsU32(2 * 1 + 0);
    const bytes = sumU64(tryAsU64(81), codeLength);
    const clampedLength = clampU64ToU32(codeLength);

    const thresholdForNew = ServiceAccountInfo.calculateThresholdBalance(items, bytes.value);
    const currentService = this.getCurrentServiceInfo();
    const thresholdForCurrent = ServiceAccountInfo.calculateThresholdBalance(
      currentService.storageUtilisationCount,
      currentService.storageUtilisationBytes,
    );

    // check if we have enough balance
    const balanceLeftForCurrent = currentService.balance - thresholdForNew;
    if (balanceLeftForCurrent < thresholdForCurrent || bytes.overflow) {
      return Result.error("insufficient funds");
    }

    // proceed with service creation
    const newService = new InMemoryService(newServiceId, {
      info: ServiceAccountInfo.create({
        codeHash,
        balance: thresholdForNew,
        accumulateMinGas,
        onTransferMinGas,
        storageUtilisationBytes: bytes.value,
        storageUtilisationCount: items,
      }),
      preimages: HashDictionary.new(),
      // add the preimage request
      lookupHistory: HashDictionary.fromEntries([
        [codeHash.asOpaque(), [new LookupHistoryItem(codeHash.asOpaque(), clampedLength, tryAsLookupHistorySlots([]))]],
      ]),
      storage: HashDictionary.new(),
    });

    // add the new service
    this.updatedState.newServices.push(newService);

    // update the balance
    // https://graypaper.fluffylabs.dev/#/9a08063/36f10236f102?v=0.6.6
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.create({
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
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.create({
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
    this.checkpointedState = AccumulationStateUpdate.copyFrom(this.updatedState);
  }

  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>,
  ): void {
    // NOTE `coreIndex` is already verified in the HC, so this is infallible.
    /** https://graypaper.fluffylabs.dev/#/9a08063/368401368401?v=0.6.6 */
    this.updatedState.authorizationQueues.set(coreIndex, authQueue);
  }

  updatePrivilegedServices(
    manager: ServiceId,
    authorizer: ServiceId,
    validators: ServiceId,
    autoAccumulate: [ServiceId, ServiceGas][],
  ): void {
    // NOTE [ToDr] I guess we should not fail if the services don't exist. */
    /** https://graypaper.fluffylabs.dev/#/9a08063/36f40036f400?v=0.6.6 */
    this.updatedState.privilegedServices = {
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

  providePreimage(serviceId: ServiceId | null, preimage: BytesBlob): Result<OK, ProvidePreimageError> {
    const service = serviceId === null ? null : this.state.getService(serviceId);
    if (service === null || serviceId === null) {
      return Result.error(ProvidePreimageError.ServiceNotFound);
    }

    // calculating the hash
    const preimageHash = blake2b.hashBytes(preimage).asOpaque<PreimageHash>();

    // checking service internal lookup
    if (serviceId === this.currentServiceId) {
      const stateLookup = this.getPreimageStatus(preimageHash, tryAsU64(preimage.length));
      if (stateLookup === null || !LookupHistoryItem.isRequested(stateLookup) || stateLookup.forgotten) {
        return Result.error(ProvidePreimageError.WasNotRequested);
      }
    } else {
      const slots = service.getLookupHistory(preimageHash, tryAsU32(preimage.length));
      const notRequested = slots === null || !LookupHistoryItem.isRequested(slots);

      if (notRequested) {
        return Result.error(ProvidePreimageError.WasNotRequested);
      }
    }

    // checking already provided preimages
    const hasPreimage = this.hasExistingPreimage(serviceId, preimageHash);
    if (hasPreimage) {
      return Result.error(ProvidePreimageError.AlreadyProvided);
    }

    // setting up the new preimage
    this.updatedState.providedPreimages.push(
      NewPreimage.create({
        serviceId: serviceId,
        item: PreimageItem.create({
          hash: preimageHash,
          blob: preimage,
        }),
      }),
    );

    return Result.ok(OK);
  }

  eject(destination: ServiceId | null, previousCodeHash: PreimageHash): Result<OK, EjectError> {
    const service = this.getServiceInfo(destination);
    if (service === null || destination === null) {
      return Result.error(EjectError.InvalidService, "Service missing");
    }

    const currentService = this.getCurrentServiceInfo();

    // check if the service expects to be ejected by us:
    const expectedCodeHash = Bytes.zero(HASH_SIZE).asOpaque<CodeHash>();
    writeServiceIdAsLeBytes(this.currentServiceId, expectedCodeHash.raw);
    if (!service.codeHash.isEqualTo(expectedCodeHash)) {
      return Result.error(EjectError.InvalidService, "Invalid code hash");
    }

    // make sure the service only has required number of storage items?
    if (service.storageUtilisationCount !== REQUIRED_NUMBER_OF_STORAGE_ITEMS_FOR_EJECT) {
      return Result.error(EjectError.InvalidPreimage, "Too many storage items");
    }

    // storage items length
    const minServiceBytes = tryAsU64(81);
    const l = tryAsU64(maxU64(service.storageUtilisationBytes, minServiceBytes) - minServiceBytes);

    // check if we have a preimage with the entire storage.
    const [isPreviousCodeExpired, errorReason] = this.isPreviousCodeExpired(destination, previousCodeHash, l);
    if (!isPreviousCodeExpired) {
      return Result.error(EjectError.InvalidPreimage, `Previous code available: ${errorReason}`);
    }

    // compute new balance of the service.
    const newBalance = sumU64(currentService.balance, service.balance);
    // TODO [ToDr] what to do in case of overflow?
    if (newBalance.overflow) {
      return Result.error(EjectError.InvalidService, "Balance overflow");
    }

    // update current service.
    this.updatedState.updatedServiceInfo = ServiceAccountInfo.create({
      ...currentService,
      balance: newBalance.value,
    });
    // and finally add an ejected service.
    this.updatedState.ejectedServices.push(destination);
    return Result.ok(OK);
  }

  private replaceOrAddStorageUpdate(key: StorageKey, value: BytesBlob | null) {
    const update =
      value === null
        ? UpdateStorage.remove({ serviceId: this.currentServiceId, key })
        : UpdateStorage.set({
            serviceId: this.currentServiceId,
            storage: StorageItem.create({ key, value }),
          });

    const index = this.updatedState.storage.findIndex((x) => x.serviceId === update.serviceId && x.key.isEqualTo(key));
    const count = index === -1 ? 0 : 1;
    this.updatedState.storage.splice(index, count, update);
  }

  read(serviceId: ServiceId | null, key: StorageKey): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }

    if (this.currentServiceId === serviceId) {
      const item = this.updatedState.storage.find((x) => x.serviceId === serviceId && x.key.isEqualTo(key));
      if (item !== undefined) {
        return item.value;
      }
    }

    const service = this.state.getService(serviceId);
    return service?.getStorage(key) ?? null;
  }

  write(key: StorageKey, data: BytesBlob | null): Result<OK, "full"> {
    const current = this.read(this.currentServiceId, key);

    const isAddingNew = current === null && data !== null;
    const isRemoving = current !== null && data === null;
    const countDiff = isAddingNew ? 1 : isRemoving ? -1 : 0;
    const lenDiff = (data?.length ?? 0) - (current?.length ?? 0);

    const serviceInfo = this.getCurrentServiceInfo();
    const items = serviceInfo.storageUtilisationCount + countDiff;
    const bytes = serviceInfo.storageUtilisationBytes + BigInt(lenDiff);

    check(items >= 0, `storageUtilisationCount has to be a positive number, got: ${items}`);
    check(bytes >= 0, `storageUtilisationBytes has to be a positive number, got: ${bytes}`);

    const overflowItems = !isU32(items);
    const overflowBytes = !isU64(bytes);

    const res = this.updateServiceStorageUtilisation(
      {
        overflow: overflowItems,
        value: overflowItems ? tryAsU32(0) : items,
      },
      {
        overflow: overflowBytes,
        value: overflowBytes ? tryAsU64(0) : bytes,
      },
      serviceInfo,
    );
    if (res.isError) {
      return Result.error("full", res.details);
    }

    this.replaceOrAddStorageUpdate(key, data);

    return Result.ok(OK);
  }

  readSnapshotLength(key: StorageKey): number | null {
    const service = this.state.getService(this.currentServiceId);
    return service?.getStorage(key)?.length ?? null;
  }

  lookup(serviceId: ServiceId | null, hash: PreimageHash): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }

    // TODO [ToDr] Should we verify availability here?
    const freshlyProvided = this.updatedState.providedPreimages.find(
      (x) => x.serviceId === serviceId && x.item.hash.isEqualTo(hash),
    );
    if (freshlyProvided !== undefined) {
      return freshlyProvided.item.blob;
    }

    const service = this.state.getService(serviceId);
    return service?.getPreimage(hash) ?? null;
  }
}

function bumpServiceId(serviceId: ServiceId) {
  const mod = 2 ** 32 - 2 ** 9;
  return tryAsServiceId(2 ** 8 + ((serviceId - 2 ** 8 + 42 + mod) % mod));
}

function preimageLenAsU32(length: U64) {
  // Safe to convert to Number and U32: we check that len < 2^32 before conversion
  return length >= 2n ** 32n ? null : tryAsU32(Number(length));
}
