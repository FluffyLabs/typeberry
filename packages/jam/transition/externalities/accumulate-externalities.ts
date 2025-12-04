import {
  type CodeHash,
  type CoreIndex,
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  type TimeSlot,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import { MIN_PUBLIC_SERVICE_INDEX } from "@typeberry/block/gp-constants.js";
import type { PreimageHash } from "@typeberry/block/preimage.js";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import { Bytes, type BytesBlob } from "@typeberry/bytes";
import type { FixedSizeArray } from "@typeberry/collections";
import type { ChainSpec } from "@typeberry/config";
import { type Blake2b, HASH_SIZE, type OpaqueHash } from "@typeberry/hash";
import {
  AccumulationStateUpdate,
  clampU64ToU32,
  EjectError,
  ForgetPreimageError,
  type general,
  NewServiceError,
  type PartiallyUpdatedState,
  type PartialState,
  PendingTransfer,
  type PreimageStatus,
  PreimageStatusKind,
  ProvidePreimageError,
  RequestPreimageError,
  slotsToPreimageStatus,
  type TRANSFER_MEMO_BYTES,
  TransferError,
  UnprivilegedError,
  UpdatePrivilegesError,
  writeServiceIdAsLeBytes,
} from "@typeberry/jam-host-calls";
import { Logger } from "@typeberry/logger";
import { maxU64, sumU64, tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import {
  type AUTHORIZATION_QUEUE_SIZE,
  LookupHistoryItem,
  type PerCore,
  PreimageItem,
  PrivilegedServices,
  ServiceAccountInfo,
  type StorageKey,
  tryAsLookupHistorySlots,
  UpdatePreimage,
  type ValidatorData,
} from "@typeberry/state";
import { assertNever, Compatibility, check, GpVersion, OK, Result } from "@typeberry/utils";

/**
 * Number of storage items required for ejection of the service.
 *
 * Value 2 seems to indicate that there is only one preimage lookup,
 * and it has to be the previous code of the service, additionally used
 * to authorize the `eject`.
 *
 * https://graypaper.fluffylabs.dev/#/9a08063/370202370502?v=0.6.6 */
const REQUIRED_NUMBER_OF_STORAGE_ITEMS_FOR_EJECT = 2;

/** https://graypaper.fluffylabs.dev/#/7e6ff6a/117101117101?v=0.6.7 */
const LOOKUP_HISTORY_ENTRY_BYTES = tryAsU64(81);
/** https://graypaper.fluffylabs.dev/#/7e6ff6a/117a01117a01?v=0.6.7 */
const BASE_STORAGE_BYTES = tryAsU64(34);

const logger = Logger.new(import.meta.filename, "externalities");

export class AccumulateExternalities
  implements PartialState, general.AccountsWrite, general.AccountsRead, general.AccountsInfo, general.AccountsLookup
{
  private checkpointedState: AccumulationStateUpdate;
  /** `x_i`: next service id we are going to create. */
  private nextNewServiceId: ServiceId;

  constructor(
    private readonly chainSpec: ChainSpec,
    private readonly blake2b: Blake2b,
    private readonly updatedState: PartiallyUpdatedState,
    /** `x_s` */
    private readonly currentServiceId: ServiceId,
    nextNewServiceIdCandidate: ServiceId,
    private readonly currentTimeslot: TimeSlot,
  ) {
    this.checkpointedState = AccumulationStateUpdate.copyFrom(updatedState.stateUpdate);
    this.nextNewServiceId = this.getNextAvailableServiceId(nextNewServiceIdCandidate);

    const service = this.updatedState.getServiceInfo(this.currentServiceId);
    if (service === null) {
      throw new Error(`Invalid state initialization. Service info missing for ${this.currentServiceId}.`);
    }
  }

  /** Return the underlying state update and checkpointed state. */
  getStateUpdates(): [AccumulationStateUpdate, AccumulationStateUpdate] {
    return [this.updatedState.stateUpdate, this.checkpointedState];
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
    const serviceInfo = this.updatedState.getServiceInfo(this.currentServiceId);
    if (serviceInfo === null) {
      throw new Error(`Missing service info for current service! ${this.currentServiceId}`);
    }
    return serviceInfo;
  }

  /**
   * Retrieve info of service with given id.
   *
   * NOTE the info may be updated compared to what is in the state.
   *
   * Takes into account newly created services as well.
   */
  getServiceInfo(destination: ServiceId | null): ServiceAccountInfo | null {
    return this.updatedState.getServiceInfo(destination);
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
    const slots = this.updatedState.getLookupHistory(this.currentTimeslot, destination, previousCodeHash, len);
    const status = slots === null ? null : slotsToPreimageStatus(slots.slots);
    // The previous code needs to be forgotten and expired.
    if (status?.status !== PreimageStatusKind.Unavailable) {
      return [false, `wrong status: ${status !== null ? PreimageStatusKind[status.status] : null}`];
    }
    const t = this.currentTimeslot;
    const isExpired = status.data[1] < t - this.chainSpec.preimageExpungePeriod;
    return [isExpired, isExpired ? "" : "not expired"];
  }

  /** `check`: https://graypaper.fluffylabs.dev/#/ab2cdbd/30c60330c603?v=0.7.2 */
  private getNextAvailableServiceId(serviceId: ServiceId): ServiceId {
    let currentServiceId = serviceId;
    const mod = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
      ? 2 ** 32 - MIN_PUBLIC_SERVICE_INDEX - 2 ** 8
      : 2 ** 32 - 2 ** 9;
    const offset = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? MIN_PUBLIC_SERVICE_INDEX : 2 ** 8;

    for (;;) {
      const service = this.getServiceInfo(currentServiceId);
      // we found an empty id
      if (service === null) {
        return currentServiceId;
      }
      // keep trying
      currentServiceId = tryAsServiceId(((currentServiceId - offset + 1 + mod) % mod) + offset);
    }
  }

  checkPreimageStatus(hash: PreimageHash, length: U64): PreimageStatus | null {
    // https://graypaper.fluffylabs.dev/#/9a08063/378102378102?v=0.6.6
    const status = this.updatedState.getLookupHistory(this.currentTimeslot, this.currentServiceId, hash, length);
    if (status === null) {
      return null;
    }

    return slotsToPreimageStatus(status.slots);
  }

  requestPreimage(hash: PreimageHash, length: U64): Result<OK, RequestPreimageError> {
    const existingPreimage = this.updatedState.getLookupHistory(
      this.currentTimeslot,
      this.currentServiceId,
      hash,
      length,
    );

    if (existingPreimage !== null) {
      const len = existingPreimage.slots.length;
      // https://graypaper.fluffylabs.dev/#/9a08063/380901380901?v=0.6.6
      if (len === PreimageStatusKind.Requested) {
        return Result.error(RequestPreimageError.AlreadyRequested, () => `Preimage already requested: hash=${hash}`);
      }
      if (len === PreimageStatusKind.Available || len === PreimageStatusKind.Reavailable) {
        return Result.error(RequestPreimageError.AlreadyAvailable, () => `Preimage already available: hash=${hash}`);
      }

      // TODO [ToDr] Not sure if we should update the service info in that case,
      // but for now we let that case fall-through.
      check`${len === PreimageStatusKind.Unavailable} preimage is not unavailable`;
    }

    // make sure we have enough balance for this update
    // https://graypaper.fluffylabs.dev/#/9a08063/381201381601?v=0.6.6
    const serviceInfo = this.getCurrentServiceInfo();
    const hasPreimage = existingPreimage !== null;
    const countDiff = hasPreimage ? 0 : 2;
    const lenDiff = length - BigInt(existingPreimage?.length ?? 0);
    const items = serviceInfo.storageUtilisationCount + countDiff;
    const bytes =
      serviceInfo.storageUtilisationBytes + BigInt(lenDiff) + (hasPreimage ? 0n : LOOKUP_HISTORY_ENTRY_BYTES);

    const res = this.updatedState.updateServiceStorageUtilisation(this.currentServiceId, items, bytes, serviceInfo);

    if (res.isError) {
      return Result.error(RequestPreimageError.InsufficientFunds, res.details);
    }

    // and now update preimages

    // TODO [ToDr] This is probably invalid. What if someome requests the same
    // hash with two different lengths over `2**32`? We will end up with the same entry.
    // hopefuly this will be prohibitevely expensive?
    const clampedLength = clampU64ToU32(length);
    if (existingPreimage === null) {
      // https://graypaper.fluffylabs.dev/#/9a08063/38a60038a600?v=0.6.6
      this.updatedState.updatePreimage(
        this.currentServiceId,
        UpdatePreimage.updateOrAdd({
          lookupHistory: new LookupHistoryItem(hash, clampedLength, tryAsLookupHistorySlots([])),
        }),
      );
    } else {
      /** https://graypaper.fluffylabs.dev/#/9a08063/38ca0038ca00?v=0.6.6 */
      this.updatedState.updatePreimage(
        this.currentServiceId,
        UpdatePreimage.updateOrAdd({
          lookupHistory: new LookupHistoryItem(
            hash,
            clampedLength,
            tryAsLookupHistorySlots([...existingPreimage.slots, this.currentTimeslot]),
          ),
        }),
      );
    }

    return Result.ok(OK);
  }

  forgetPreimage(hash: PreimageHash, length: U64): Result<OK, ForgetPreimageError> {
    const serviceId = this.currentServiceId;
    const status = this.updatedState.getLookupHistory(this.currentTimeslot, this.currentServiceId, hash, length);
    if (status === null) {
      return Result.error(ForgetPreimageError.NotFound, () => `Preimage not found: hash=${hash}, length=${length}`);
    }

    const s = slotsToPreimageStatus(status.slots);

    const updateStorageUtilisation = () => {
      const serviceInfo = this.getCurrentServiceInfo();
      const items = serviceInfo.storageUtilisationCount - 2; // subtracting 1 for lookup history item and 1 for the preimage
      const bytes = serviceInfo.storageUtilisationBytes - length - LOOKUP_HISTORY_ENTRY_BYTES;
      return this.updatedState.updateServiceStorageUtilisation(this.currentServiceId, items, bytes, serviceInfo);
    };

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/380802380802?v=0.7.2
    if (s.status === PreimageStatusKind.Requested) {
      const res = updateStorageUtilisation();
      if (res.isError) {
        return Result.error(ForgetPreimageError.StorageUtilisationError, res.details);
      }
      this.updatedState.updatePreimage(
        serviceId,
        UpdatePreimage.remove({
          hash: status.hash,
          length: status.length,
        }),
      );
      return Result.ok(OK);
    }

    const t = this.currentTimeslot;
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/380802380802?v=0.7.2
    if (s.status === PreimageStatusKind.Unavailable) {
      const y = s.data[1];
      if (y < t - this.chainSpec.preimageExpungePeriod) {
        const res = updateStorageUtilisation();
        if (res.isError) {
          return Result.error(ForgetPreimageError.StorageUtilisationError, res.details);
        }
        this.updatedState.updatePreimage(
          serviceId,
          UpdatePreimage.remove({
            hash: status.hash,
            length: status.length,
          }),
        );
        return Result.ok(OK);
      }

      return Result.error(
        ForgetPreimageError.NotExpired,
        () => `Preimage not expired: y=${y}, timeslot=${t}, period=${this.chainSpec.preimageExpungePeriod}`,
      );
    }

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/382802383302?v=0.7.2
    if (s.status === PreimageStatusKind.Available) {
      this.updatedState.updatePreimage(
        serviceId,
        UpdatePreimage.updateOrAdd({
          lookupHistory: new LookupHistoryItem(status.hash, status.length, tryAsLookupHistorySlots([s.data[0], t])),
        }),
      );
      return Result.ok(OK);
    }

    // https://graypaper.fluffylabs.dev/#/ab2cdbd/384002384c02?v=0.7.2
    if (s.status === PreimageStatusKind.Reavailable) {
      const y = s.data[1];
      if (y < t - this.chainSpec.preimageExpungePeriod) {
        this.updatedState.updatePreimage(
          serviceId,
          UpdatePreimage.updateOrAdd({
            lookupHistory: new LookupHistoryItem(status.hash, status.length, tryAsLookupHistorySlots([s.data[2], t])),
          }),
        );

        return Result.ok(OK);
      }

      return Result.error(
        ForgetPreimageError.NotExpired,
        () => `Preimage not expired: y=${y}, timeslot=${t}, period=${this.chainSpec.preimageExpungePeriod}`,
      );
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
      return Result.error(TransferError.DestinationNotFound, () => `Destination service not found: ${destinationId}`);
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/371301371301?v=0.6.6 */
    if (gas < destination.onTransferMinGas) {
      return Result.error(TransferError.GasTooLow, () => `Gas ${gas} below minimum ${destination.onTransferMinGas}`);
    }

    /** https://graypaper.fluffylabs.dev/#/9a08063/371b01371b01?v=0.6.6 */
    const newBalance = source.balance - amount;
    const thresholdBalance = ServiceAccountInfo.calculateThresholdBalance(
      source.storageUtilisationCount,
      source.storageUtilisationBytes,
      source.gratisStorage,
    );
    if (newBalance < thresholdBalance) {
      return Result.error(
        TransferError.BalanceBelowThreshold,
        () => `Balance ${newBalance} below threshold ${thresholdBalance}`,
      );
    }

    // outgoing transfer
    this.updatedState.stateUpdate.transfers.push(
      PendingTransfer.create({
        source: this.currentServiceId,
        destination: destinationId,
        amount,
        memo,
        gas,
      }),
    );

    // reduced balance
    this.updatedState.updateServiceInfo(
      this.currentServiceId,
      ServiceAccountInfo.create({
        ...source,
        balance: tryAsU64(newBalance),
      }),
    );
    return Result.ok(OK);
  }

  newService(
    codeHash: CodeHash,
    codeLength: U64,
    accumulateMinGas: ServiceGas,
    onTransferMinGas: ServiceGas,
    gratisStorage: U64,
    wantedServiceId: U64,
  ): Result<ServiceId, NewServiceError> {
    // calculate the threshold. Storage is empty, one preimage requested.
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/115901115901?v=0.6.7
    const items = tryAsU32(2 * 1 + 0);
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/116b01116b01?v=0.6.7
    const bytes = sumU64(LOOKUP_HISTORY_ENTRY_BYTES, codeLength);
    const clampedLength = clampU64ToU32(codeLength);

    // check if we are priviledged to set gratis storage
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/369203369603?v=0.6.7
    if (gratisStorage !== tryAsU64(0) && this.currentServiceId !== this.updatedState.getPrivilegedServices().manager) {
      return Result.error(
        NewServiceError.UnprivilegedService,
        () => `Service ${this.currentServiceId} not privileged to set gratis storage`,
      );
    }

    // check if we have enough balance
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/369e0336a303?v=0.6.7
    const thresholdForNew = ServiceAccountInfo.calculateThresholdBalance(items, bytes.value, gratisStorage);
    const currentService = this.getCurrentServiceInfo();
    const thresholdForCurrent = ServiceAccountInfo.calculateThresholdBalance(
      currentService.storageUtilisationCount,
      currentService.storageUtilisationBytes,
      currentService.gratisStorage,
    );
    const balanceLeftForCurrent = currentService.balance - thresholdForNew;
    if (balanceLeftForCurrent < thresholdForCurrent || bytes.overflow) {
      return Result.error(
        NewServiceError.InsufficientFunds,
        () =>
          `Insufficient funds: balance=${currentService.balance}, required=${thresholdForNew}, overflow=${bytes.overflow}`,
      );
    }

    // `a`: https://graypaper.fluffylabs.dev/#/ab2cdbd/366b02366d02?v=0.7.2
    const newAccount = ServiceAccountInfo.create({
      codeHash,
      balance: thresholdForNew,
      accumulateMinGas,
      onTransferMinGas,
      storageUtilisationBytes: bytes.value,
      storageUtilisationCount: items,
      gratisStorage,
      created: this.currentTimeslot,
      lastAccumulation: tryAsTimeSlot(0),
      parentService: this.currentServiceId,
    });

    const newLookupItem = new LookupHistoryItem(codeHash.asOpaque(), clampedLength, tryAsLookupHistorySlots([]));

    // `s`: https://graypaper.fluffylabs.dev/#/ab2cdbd/361003361003?v=0.7.2
    const updatedCurrentAccount = ServiceAccountInfo.create({
      ...currentService,
      balance: tryAsU64(balanceLeftForCurrent),
    });

    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      if (
        wantedServiceId < MIN_PUBLIC_SERVICE_INDEX &&
        this.currentServiceId === this.updatedState.getPrivilegedServices().registrar
      ) {
        // NOTE: It's safe to cast to `Number` here, bcs here service ID cannot be bigger than 2**16
        const newServiceId = tryAsServiceId(Number(wantedServiceId));
        if (this.getServiceInfo(newServiceId) !== null) {
          return Result.error(
            NewServiceError.RegistrarServiceIdAlreadyTaken,
            () => `Service ID ${newServiceId} already taken`,
          );
        }
        // add the new service with selected ID
        // https://graypaper.fluffylabs.dev/#/ab2cdbd/36be0336c003?v=0.7.2
        this.updatedState.createService(newServiceId, newAccount, newLookupItem);
        // update the balance of current service
        // https://graypaper.fluffylabs.dev/#/ab2cdbd/36c20336c403?v=0.7.2
        this.updatedState.updateServiceInfo(this.currentServiceId, updatedCurrentAccount);
        return Result.ok(newServiceId);
      }
      // NOTE: in case the service is not a registrar or the requested serviceId is out of range,
      // we completely ignore the `wantedServiceId` and assign a random one
    }

    const newServiceId = this.nextNewServiceId;

    // add the new service
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/36cb0236cb02?v=0.6.7
    this.updatedState.createService(newServiceId, newAccount, newLookupItem);

    // update the balance of current service
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/36ec0336ee03?v=0.7.2
    this.updatedState.updateServiceInfo(this.currentServiceId, updatedCurrentAccount);

    // update the next service id we are going to create next
    // https://graypaper.fluffylabs.dev/#/7e6ff6a/36a70336a703?v=0.6.7
    this.nextNewServiceId = this.getNextAvailableServiceId(bumpServiceId(newServiceId));

    return Result.ok(newServiceId);
  }

  upgradeService(codeHash: CodeHash, gas: U64, allowance: U64): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/36c80336c803?v=0.6.6 */
    const serviceInfo = this.getCurrentServiceInfo();
    this.updatedState.updateServiceInfo(
      this.currentServiceId,
      ServiceAccountInfo.create({
        ...serviceInfo,
        codeHash,
        accumulateMinGas: tryAsServiceGas(gas),
        onTransferMinGas: tryAsServiceGas(allowance),
      }),
    );
  }

  updateValidatorsData(validatorsData: PerValidator<ValidatorData>): Result<OK, UnprivilegedError> {
    /** https://graypaper.fluffylabs.dev/#/7e6ff6a/362802362d02?v=0.6.7 */
    const currentDelegator = this.updatedState.getPrivilegedServices().delegator;

    if (currentDelegator !== this.currentServiceId) {
      logger.trace`Current service id (${this.currentServiceId}) is not a validators manager. (expected: ${currentDelegator}) and cannot update validators data. Ignoring`;
      return Result.error(
        UnprivilegedError,
        () => `Service ${this.currentServiceId} is not delegator (expected: ${currentDelegator})`,
      );
    }

    this.updatedState.stateUpdate.validatorsData = validatorsData;
    return Result.ok(OK);
  }

  checkpoint(): void {
    /** https://graypaper.fluffylabs.dev/#/9a08063/362202362202?v=0.6.6 */
    this.checkpointedState = AccumulationStateUpdate.copyFrom(this.updatedState.stateUpdate);
  }

  updateAuthorizationQueue(
    coreIndex: CoreIndex,
    authQueue: FixedSizeArray<AuthorizerHash, AUTHORIZATION_QUEUE_SIZE>,
    assigners: ServiceId | null,
  ): Result<OK, UpdatePrivilegesError> {
    /** https://graypaper.fluffylabs.dev/#/7e6ff6a/36a40136a401?v=0.6.7 */

    // NOTE `coreIndex` is already verified in the HC, so this is infallible.
    const currentAssigners = this.updatedState.getPrivilegedServices().assigners[coreIndex];

    if (currentAssigners !== this.currentServiceId) {
      logger.trace`Current service id (${this.currentServiceId}) is not an auth manager of core ${coreIndex} (expected: ${currentAssigners}) and cannot update authorization queue.`;
      return Result.error(
        UpdatePrivilegesError.UnprivilegedService,
        () => `Service ${this.currentServiceId} not assigner for core ${coreIndex} (expected: ${currentAssigners})`,
      );
    }

    if (assigners === null && Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      logger.trace`The new auth manager is not a valid service id.`;
      return Result.error(
        UpdatePrivilegesError.InvalidServiceId,
        () => `New auth manager is null for core ${coreIndex}`,
      );
    }

    this.updatedState.stateUpdate.authorizationQueues.set(coreIndex, authQueue);
    return Result.ok(OK);
  }

  updatePrivilegedServices(
    manager: ServiceId | null,
    assigners: PerCore<ServiceId>,
    delegator: ServiceId | null,
    registrar: ServiceId | null,
    autoAccumulateServices: Map<ServiceId, ServiceGas>,
  ): Result<OK, UpdatePrivilegesError> {
    if (!Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      /** https://graypaper.fluffylabs.dev/#/7e6ff6a/36d90036de00?v=0.6.7 */
      const current = this.updatedState.getPrivilegedServices();
      const isManager = current.manager === this.currentServiceId;
      if (!isManager) {
        return Result.error(
          UpdatePrivilegesError.UnprivilegedService,
          () => `Service ${this.currentServiceId} is not manager`,
        );
      }

      if (manager === null || delegator === null) {
        return Result.error(
          UpdatePrivilegesError.InvalidServiceId,
          () => "Either manager or delegator is not a valid service id.",
        );
      }

      this.updatedState.stateUpdate.privilegedServices = PrivilegedServices.create({
        manager,
        assigners,
        delegator,
        registrar: registrar ?? tryAsServiceId(0),
        autoAccumulateServices,
      });

      return Result.ok(OK);
    }

    if (manager === null || delegator === null || registrar === null) {
      return Result.error(
        UpdatePrivilegesError.InvalidServiceId,
        () => "Either manager or delegator or registrar is not a valid service id.",
      );
    }

    // finally update the privileges
    this.updatedState.stateUpdate.privilegedServices = PrivilegedServices.create({
      manager,
      assigners,
      delegator,
      registrar: registrar ?? tryAsServiceId(0),
      autoAccumulateServices,
    });

    return Result.ok(OK);
  }

  yield(hash: OpaqueHash): void {
    /** https://graypaper.fluffylabs.dev/#/ab2cdbd/380f03381503?v=0.7.2 */
    this.updatedState.stateUpdate.yieldedRoot = hash;
  }

  providePreimage(serviceId: ServiceId | null, preimage: BytesBlob): Result<OK, ProvidePreimageError> {
    // we need to explicitly check if service exists, since it's a different error.
    // we also check if it's in newly created
    // https://graypaper.fluffylabs.dev/#/ab2cdbd/384e03384e03?v=0.7.2
    const service = serviceId === null ? null : this.updatedState.getServiceInfo(serviceId);
    if (service === null || serviceId === null) {
      return Result.error(ProvidePreimageError.ServiceNotFound, () => `Service not found: ${serviceId}`);
    }

    // calculating the hash
    const preimageHash = this.blake2b.hashBytes(preimage).asOpaque<PreimageHash>();

    // checking service internal lookup
    const stateLookup = this.updatedState.getLookupHistory(
      this.currentTimeslot,
      serviceId,
      preimageHash,
      tryAsU64(preimage.length),
    );
    if (stateLookup === null || !LookupHistoryItem.isRequested(stateLookup)) {
      return Result.error(
        ProvidePreimageError.WasNotRequested,
        () => `Preimage was not requested: hash=${preimageHash}, service=${serviceId}`,
      );
    }

    // checking already provided preimages
    const hasPreimage = this.updatedState.hasPreimage(serviceId, preimageHash);
    if (hasPreimage) {
      return Result.error(
        ProvidePreimageError.AlreadyProvided,
        () => `Preimage already provided: hash=${preimageHash}, service=${serviceId}`,
      );
    }

    // setting up the new preimage
    const providedFor = serviceId;
    const update = UpdatePreimage.provide({
      preimage: PreimageItem.create({
        hash: preimageHash,
        blob: preimage,
      }),
      slot: this.currentTimeslot,
      providedFor,
    });

    this.updatedState.updatePreimage(serviceId, update);

    if (this.currentServiceId !== providedFor) {
      this.updatedState.updatePreimage(this.currentServiceId, update);
    }

    return Result.ok(OK);
  }

  eject(destination: ServiceId | null, previousCodeHash: PreimageHash): Result<OK, EjectError> {
    const service = this.getServiceInfo(destination);
    const isRemoved =
      this.updatedState.stateUpdate.services.removed.find((serviceId) => serviceId === destination) !== undefined;

    if (service === null || destination === null || isRemoved) {
      return Result.error(EjectError.InvalidService, () => "Service missing");
    }

    const currentService = this.getCurrentServiceInfo();

    // check if the service expects to be ejected by us:
    const expectedCodeHash = Bytes.zero(HASH_SIZE).asOpaque<CodeHash>();
    writeServiceIdAsLeBytes(this.currentServiceId, expectedCodeHash.raw);
    if (!service.codeHash.isEqualTo(expectedCodeHash)) {
      return Result.error(EjectError.InvalidService, () => "Invalid code hash");
    }

    // make sure the service only has required number of storage items?
    if (service.storageUtilisationCount !== REQUIRED_NUMBER_OF_STORAGE_ITEMS_FOR_EJECT) {
      return Result.error(EjectError.InvalidPreimage, () => "Too many storage items");
    }

    // storage items length
    const l = tryAsU64(
      maxU64(service.storageUtilisationBytes, LOOKUP_HISTORY_ENTRY_BYTES) - LOOKUP_HISTORY_ENTRY_BYTES,
    );

    // check if we have a preimage with the entire storage.
    const [isPreviousCodeExpired, errorReason] = this.isPreviousCodeExpired(destination, previousCodeHash, l);
    if (!isPreviousCodeExpired) {
      return Result.error(EjectError.InvalidPreimage, () => `Previous code available: ${errorReason}`);
    }

    // compute new balance of the service.
    const newBalance = sumU64(currentService.balance, service.balance);
    // TODO [ToDr] what to do in case of overflow?
    if (newBalance.overflow) {
      return Result.error(EjectError.InvalidService, () => "Balance overflow");
    }

    // update current service.
    this.updatedState.updateServiceInfo(
      this.currentServiceId,
      ServiceAccountInfo.create({
        ...currentService,
        balance: newBalance.value,
      }),
    );
    // and finally add an ejected service.
    this.updatedState.stateUpdate.services.removed.push(destination);

    // take care of the code preimage and its lookup history
    // Safe, because we know the preimage is valid, and it's the code of the service, which is bounded by maximal service code size anyway (much smaller than 2**32 bytes).
    const preimageLength = tryAsU32(Number(l));
    const preimages = this.updatedState.stateUpdate.services.preimages.get(destination) ?? [];
    preimages.push(UpdatePreimage.remove({ hash: previousCodeHash, length: preimageLength }));
    this.updatedState.stateUpdate.services.preimages.set(destination, preimages);

    return Result.ok(OK);
  }

  read(serviceId: ServiceId | null, rawKey: StorageKey): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }
    return this.updatedState.getStorage(serviceId, rawKey);
  }

  write(rawKey: StorageKey, data: BytesBlob | null): Result<number | null, "full"> {
    const rawKeyBytes = tryAsU64(rawKey.length);
    const current = this.read(this.currentServiceId, rawKey);
    const isAddingNew = current === null && data !== null;
    const isRemoving = current !== null && data === null;
    const countDiff = isAddingNew ? 1 : isRemoving ? -1 : 0;
    const lenDiff = (data?.length ?? 0) - (current?.length ?? 0);
    const baseStorageDiff = isAddingNew ? BASE_STORAGE_BYTES : isRemoving ? -BASE_STORAGE_BYTES : 0n;
    const keyDiffRemoving = isRemoving ? -rawKeyBytes : 0n;
    const keyDiffAdding = isAddingNew ? rawKeyBytes : 0n;
    const rawKeyDiff = keyDiffRemoving + keyDiffAdding;

    const serviceInfo = this.getCurrentServiceInfo();
    const items = serviceInfo.storageUtilisationCount + countDiff;
    const bytes = serviceInfo.storageUtilisationBytes + BigInt(lenDiff) + baseStorageDiff + rawKeyDiff;
    const res = this.updatedState.updateServiceStorageUtilisation(this.currentServiceId, items, bytes, serviceInfo);
    if (res.isError) {
      return Result.error("full", res.details);
    }

    this.updatedState.updateStorage(this.currentServiceId, rawKey, data);

    return Result.ok(current === null ? null : current.length);
  }

  lookup(serviceId: ServiceId | null, hash: PreimageHash): BytesBlob | null {
    if (serviceId === null) {
      return null;
    }

    return this.updatedState.getPreimage(serviceId, hash);
  }
}

function bumpServiceId(serviceId: ServiceId): ServiceId {
  const mod = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
    ? 2 ** 32 - MIN_PUBLIC_SERVICE_INDEX - 2 ** 8
    : 2 ** 32 - 2 ** 9;
  const offset = Compatibility.isGreaterOrEqual(GpVersion.V0_7_1) ? MIN_PUBLIC_SERVICE_INDEX : 2 ** 8;
  return tryAsServiceId(offset + ((serviceId - offset + 42 + mod) % mod));
}
