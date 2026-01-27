import { describe, it } from "node:test";
import {
  type PerValidator,
  type ServiceGas,
  type ServiceId,
  tryAsCoreIndex,
  tryAsPerValidator,
  tryAsServiceGas,
  tryAsServiceId,
  tryAsTimeSlot,
} from "@typeberry/block";
import type { AuthorizerHash } from "@typeberry/block/refine-context.js";
import { Bytes } from "@typeberry/bytes";
import { FixedSizeArray } from "@typeberry/collections";
import { tinyChainSpec } from "@typeberry/config";
import { BANDERSNATCH_KEY_BYTES, BLS_KEY_BYTES, ED25519_KEY_BYTES } from "@typeberry/crypto";
import { HASH_SIZE } from "@typeberry/hash";
import { AccumulationStateUpdate, PendingTransfer } from "@typeberry/jam-host-calls";
import { TRANSFER_MEMO_BYTES } from "@typeberry/jam-host-calls/externalities/partial-state.js";
import { MAX_VALUE_U64, tryAsU32, tryAsU64, type U64 } from "@typeberry/numbers";
import {
  AUTHORIZATION_QUEUE_SIZE,
  InMemoryState,
  PreimageItem,
  PrivilegedServices,
  ServiceAccountInfo,
  StorageItem,
  tryAsPerCore,
  UpdatePreimage,
  UpdateService,
  UpdateStorage,
  VALIDATOR_META_BYTES,
  ValidatorData,
} from "@typeberry/state";
import { deepEqual } from "@typeberry/utils";
import { mergePerallelAccumulationResults } from "./accumulation-result-merge-utils.js";

class AccumulationStateUpdateBuilder {
  private stateUpdate = AccumulationStateUpdate.empty();

  private constructor() {}

  static new() {
    return new AccumulationStateUpdateBuilder();
  }

  withTransfers(transfers: PendingTransfer[]) {
    this.stateUpdate.transfers = transfers;
    return this;
  }

  withPrivilegedServices(privilegedServices: PrivilegedServices) {
    this.stateUpdate.privilegedServices = privilegedServices;
    return this;
  }

  withDelegator(maybeDelegatorServiceId: number) {
    if (this.stateUpdate.privilegedServices === null) {
      throw new Error("PrivilegedServices have not been initialized yet. Use `withPrivilegedServices` first");
    }
    const delegator = tryAsServiceId(maybeDelegatorServiceId);
    this.withPrivilegedServices({
      ...this.stateUpdate.privilegedServices,
      delegator,
    });

    return this;
  }

  withRegistrar(maybeRegistarServiceId: number) {
    if (this.stateUpdate.privilegedServices === null) {
      throw new Error("PrivilegedServices have not been initialized yet. Use `withPrivilegedServices` first");
    }
    const registrar = tryAsServiceId(maybeRegistarServiceId);
    this.withPrivilegedServices({
      ...this.stateUpdate.privilegedServices,
      registrar,
    });

    return this;
  }

  withAssigners(maybeAssigners: number[]) {
    if (this.stateUpdate.privilegedServices === null) {
      throw new Error("PrivilegedServices have not been initialized yet. Use `withPrivilegedServices` first");
    }

    const assigners = tryAsPerCore(maybeAssigners.map(tryAsServiceId), tinyChainSpec);
    this.withPrivilegedServices({
      ...this.stateUpdate.privilegedServices,
      assigners,
    });

    return this;
  }

  withValidatorsData(validatorsData: PerValidator<ValidatorData>) {
    this.stateUpdate.validatorsData = validatorsData;
    return this;
  }

  withAuthorizationQueue(maybeCoreIndex: number, queue: AuthorizerHash[]) {
    const coreIndex = tryAsCoreIndex(maybeCoreIndex);
    const fixedQueue = FixedSizeArray.new(queue, AUTHORIZATION_QUEUE_SIZE);
    this.stateUpdate.authorizationQueues.set(coreIndex, fixedQueue);
    return this;
  }

  withServiceStorage(maybeServiceId: number, updates: UpdateStorage[]) {
    const serviceId = tryAsServiceId(maybeServiceId);
    this.stateUpdate.services.storage.set(serviceId, updates);
    return this;
  }

  get() {
    return this.stateUpdate;
  }
}

class AccumulationResultsBuilder {
  private results = new Map<ServiceId, { consumedGas: ServiceGas; stateUpdate: AccumulationStateUpdate }>();

  private constructor() {}

  static new() {
    return new AccumulationResultsBuilder();
  }

  add(maybeServiceId: number, stateUpdate: AccumulationStateUpdate, consumedGas = 100n) {
    const serviceId = tryAsServiceId(maybeServiceId);

    if (this.results.has(serviceId)) {
      throw new Error(`Service(${serviceId}) already exists in the results`);
    }

    this.results.set(serviceId, { consumedGas: tryAsServiceGas(consumedGas), stateUpdate });

    return this;
  }

  get() {
    return this.results;
  }
}

function createTransfer(opts: { source: number; destination: number; amount: U64; gas: bigint }): PendingTransfer {
  return PendingTransfer.create({
    source: tryAsServiceId(opts.source),
    destination: tryAsServiceId(opts.destination),
    amount: opts.amount,
    memo: Bytes.fill(TRANSFER_MEMO_BYTES, 0),
    gas: tryAsServiceGas(opts.gas),
  });
}

function createValidatorData(i: number): ValidatorData {
  return ValidatorData.create({
    bandersnatch: Bytes.fill(BANDERSNATCH_KEY_BYTES, i).asOpaque(),
    bls: Bytes.fill(BLS_KEY_BYTES, i).asOpaque(),
    ed25519: Bytes.fill(ED25519_KEY_BYTES, i).asOpaque(),
    metadata: Bytes.fill(VALIDATOR_META_BYTES, i).asOpaque(),
  });
}

function createValidatorsData(i: number): PerValidator<ValidatorData> {
  return tryAsPerValidator(new Array(tinyChainSpec.validatorsCount).fill(createValidatorData(i)), tinyChainSpec);
}

function createStorageItem(keyByte: number, valueByte: number): StorageItem {
  const key = Bytes.fill(4, keyByte).asOpaque();
  const value = Bytes.fill(3, valueByte);
  return StorageItem.create({ key, value });
}

function createStorageSetUpdate(keyByte: number, valueByte: number): UpdateStorage {
  return UpdateStorage.set({ storage: createStorageItem(keyByte, valueByte) });
}

function createStorageRemoveUpdate(keyByte: number): UpdateStorage {
  const key = Bytes.fill(4, keyByte).asOpaque();
  return UpdateStorage.remove({ key });
}

function createPrivilegedServices(data: Partial<PrivilegedServices> = {}) {
  const DEFAULT_PRIVILEGED_SERVICES = PrivilegedServices.create({
    manager: tryAsServiceId(0),
    assigners: tryAsPerCore(new Array(tinyChainSpec.coresCount).fill(tryAsServiceId(0)), tinyChainSpec),
    delegator: tryAsServiceId(0),
    registrar: tryAsServiceId(0),
    autoAccumulateServices: new Map(),
  });

  return PrivilegedServices.create({
    ...DEFAULT_PRIVILEGED_SERVICES,
    ...data,
  });
}

describe("mergePerallelAccumulationResults", () => {
  describe("mergePrivilegedServices", () => {
    it("should update manager, assigners, delegator, registrar, and autoAccumulateServices from privileged service results", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();
      const currentManagerServiceId = state.privilegedServices.manager;
      const newManager = tryAsServiceId(42);
      const newAssigners = tryAsPerCore(Array(tinyChainSpec.coresCount).fill(tryAsServiceId(7)), tinyChainSpec);
      const newDelegator = tryAsServiceId(99);
      const newRegistrar = tryAsServiceId(123);
      const newAutoAccumulateServices = new Map([
        [tryAsServiceId(1), tryAsServiceGas(100n)],
        [tryAsServiceId(2), tryAsServiceGas(0n)],
      ]);

      const newPrivilegedServices = PrivilegedServices.create({
        manager: newManager,
        assigners: newAssigners,
        delegator: newDelegator,
        registrar: newRegistrar,
        autoAccumulateServices: newAutoAccumulateServices,
      });

      const results = AccumulationResultsBuilder.new()
        .add(
          currentManagerServiceId,
          AccumulationStateUpdateBuilder.new().withPrivilegedServices(newPrivilegedServices).get(),
        )
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, newPrivilegedServices);
    });

    it("should not update privilegedServices if there is no privileged services in state update", () => {
      const initialPrivilegedServices = PrivilegedServices.create({
        manager: tryAsServiceId(1),
        assigners: tryAsPerCore(Array(tinyChainSpec.coresCount).fill(tryAsServiceId(2)), tinyChainSpec),
        delegator: tryAsServiceId(3),
        registrar: tryAsServiceId(4),
        autoAccumulateServices: new Map([[tryAsServiceId(5), tryAsServiceGas(123n)]]),
      });

      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: initialPrivilegedServices,
      });
      const currentManagerServiceId = state.privilegedServices.manager;

      const inputState = AccumulationStateUpdate.empty();

      const results = AccumulationResultsBuilder.new()
        .add(currentManagerServiceId, AccumulationStateUpdate.empty())
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, null);
    });

    it("should update registrar (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const registrar = tryAsServiceId(5);
      const initialPrivilegedServices = createPrivilegedServices({ manager, registrar });
      const state = InMemoryState.partial(tinyChainSpec, { privilegedServices: initialPrivilegedServices });

      const inputState = AccumulationStateUpdateBuilder.new().get();

      const newRegistrar = tryAsServiceId(42);

      const stateUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withRegistrar(newRegistrar)
        .get();

      const results = AccumulationResultsBuilder.new().add(registrar, stateUpdate).get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, createPrivilegedServices({ manager, registrar: newRegistrar }));
    });

    it("should not update registrar (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const registrar = tryAsServiceId(5);
      const delegator = tryAsServiceId(6);
      const assignerA = tryAsServiceId(7);
      const assignerB = tryAsServiceId(8);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);
      const initialPrivilegedServices = createPrivilegedServices({ manager, registrar, delegator, assigners });
      const state = InMemoryState.partial(tinyChainSpec, { privilegedServices: initialPrivilegedServices });

      const inputState = AccumulationStateUpdateBuilder.new().get();

      const newRegistrar = tryAsServiceId(42);

      const stateUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withRegistrar(newRegistrar)
        .get();

      const results = AccumulationResultsBuilder.new()
        .add(delegator, AccumulationStateUpdate.copyFrom(stateUpdate))
        .add(assignerA, AccumulationStateUpdate.copyFrom(stateUpdate))
        .add(assignerB, AccumulationStateUpdate.copyFrom(stateUpdate))
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, initialPrivilegedServices);
    });

    it("shoult update delegator (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const delegator = tryAsServiceId(5);
      const initialPrivilegedServices = createPrivilegedServices({ manager, delegator });
      const state = InMemoryState.partial(tinyChainSpec, { privilegedServices: initialPrivilegedServices });

      const inputState = AccumulationStateUpdateBuilder.new().get();

      const newDelegator = tryAsServiceId(42);

      const stateUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withDelegator(newDelegator)
        .get();

      const results = AccumulationResultsBuilder.new().add(delegator, stateUpdate).get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, createPrivilegedServices({ manager, delegator: newDelegator }));
    });

    it("should not update delegator (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const registrar = tryAsServiceId(5);
      const delegator = tryAsServiceId(6);
      const assignerA = tryAsServiceId(7);
      const assignerB = tryAsServiceId(8);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);
      const initialPrivilegedServices = createPrivilegedServices({ manager, registrar, delegator, assigners });
      const state = InMemoryState.partial(tinyChainSpec, { privilegedServices: initialPrivilegedServices });

      const inputState = AccumulationStateUpdateBuilder.new().get();

      const newDelegator = tryAsServiceId(42);

      const stateUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withDelegator(newDelegator)
        .get();

      const results = AccumulationResultsBuilder.new()
        .add(registrar, AccumulationStateUpdate.copyFrom(stateUpdate))
        .add(assignerA, AccumulationStateUpdate.copyFrom(stateUpdate))
        .add(assignerB, AccumulationStateUpdate.copyFrom(stateUpdate))
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, initialPrivilegedServices);
    });

    it("shoult update assigner (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const delegator = tryAsServiceId(2);
      const registrar = tryAsServiceId(3);
      const assignerA = tryAsServiceId(10);
      const assignerB = tryAsServiceId(11);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);
      const initialPrivilegedServices = createPrivilegedServices({ manager, assigners, delegator, registrar });
      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: initialPrivilegedServices,
      });

      const inputState = AccumulationStateUpdate.empty();

      const newAssigners = [...assigners];
      newAssigners[0] = tryAsServiceId(99);

      const results = AccumulationResultsBuilder.new()
        .add(
          assignerA,
          AccumulationStateUpdateBuilder.new()
            .withPrivilegedServices(initialPrivilegedServices)
            .withAssigners(newAssigners)
            .get(),
        )
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(
        resultState.privilegedServices,
        createPrivilegedServices({
          ...initialPrivilegedServices,
          assigners: tryAsPerCore(newAssigners, tinyChainSpec),
        }),
      );
    });

    it("shoult not update assigner (own privledges)", () => {
      const manager = tryAsServiceId(1);
      const delegator = tryAsServiceId(2);
      const registrar = tryAsServiceId(3);
      const assignerA = tryAsServiceId(10);
      const assignerB = tryAsServiceId(11);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);
      const initialPrivilegedServices = createPrivilegedServices({ manager, assigners, delegator, registrar });
      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: initialPrivilegedServices,
      });

      const inputState = AccumulationStateUpdate.empty();

      const newAssignersToSetByAssignerA = [assignerA, 98];
      const newAssignersToSetByAssignerB = [99, assignerB];
      const newAssignersToSetByOthers = [100, 101];

      const results = AccumulationResultsBuilder.new()
        .add(
          assignerA,
          AccumulationStateUpdateBuilder.new()
            .withPrivilegedServices(initialPrivilegedServices)
            .withAssigners(newAssignersToSetByAssignerA)
            .get(),
        )
        .add(
          assignerB,
          AccumulationStateUpdateBuilder.new()
            .withPrivilegedServices(initialPrivilegedServices)
            .withAssigners(newAssignersToSetByAssignerB)
            .get(),
        )
        .add(
          delegator,
          AccumulationStateUpdateBuilder.new()
            .withPrivilegedServices(initialPrivilegedServices)
            .withAssigners(newAssignersToSetByOthers)
            .get(),
        )
        .add(
          registrar,
          AccumulationStateUpdateBuilder.new()
            .withPrivilegedServices(initialPrivilegedServices)
            .withAssigners(newAssignersToSetByOthers)
            .get(),
        )
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, initialPrivilegedServices);
    });

    it("should override self-updated changes", () => {
      const manager = tryAsServiceId(1);
      const delegator = tryAsServiceId(2);
      const registrar = tryAsServiceId(3);
      const assignerA = tryAsServiceId(4);
      const assignerB = tryAsServiceId(5);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);

      const initialPrivilegedServices = createPrivilegedServices({ manager, assigners, registrar, delegator });

      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: initialPrivilegedServices,
      });

      const inputState = AccumulationStateUpdate.empty();

      const delegatorUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withDelegator(22)
        .get();
      const registrarUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withRegistrar(23)
        .get();
      const assignerAUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withAssigners([24, assignerB])
        .get();
      const assignerBUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withAssigners([assignerA, 25])
        .get();

      const managerUpdate = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(initialPrivilegedServices)
        .withDelegator(32)
        .withRegistrar(33)
        .withAssigners([34, 35])
        .get();

      const results = AccumulationResultsBuilder.new()
        .add(delegator, delegatorUpdate)
        .add(registrar, registrarUpdate)
        .add(assignerA, assignerAUpdate)
        .add(assignerB, assignerBUpdate)
        .add(manager, managerUpdate)
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.privilegedServices, managerUpdate.privilegedServices);
    });
  });

  describe("mergeValidatorsData", () => {
    it("should update validators data when delegator service provides it", () => {
      const delegatorServiceId = tryAsServiceId(5);
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(createPrivilegedServices())
        .withDelegator(delegatorServiceId)
        .get();

      const newValidatorsData = createValidatorsData(1);

      const results = AccumulationResultsBuilder.new()
        .add(delegatorServiceId, AccumulationStateUpdateBuilder.new().withValidatorsData(newValidatorsData).get())
        .get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.validatorsData, newValidatorsData);
    });

    it("should not update validators data when non-delegator service provides it", () => {
      const delegatorServiceId = tryAsServiceId(5);
      const otherServiceId = tryAsServiceId(10);
      const state = InMemoryState.empty(tinyChainSpec);
      const initialValidatorsData = createValidatorsData(0);

      const inputState = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(createPrivilegedServices())
        .withDelegator(delegatorServiceId)
        .withValidatorsData(initialValidatorsData)
        .get();

      const newValidatorsData = createValidatorsData(1);
      const stateUpdate = AccumulationStateUpdateBuilder.new().withValidatorsData(newValidatorsData).get();

      const results = new Map([[otherServiceId, { consumedGas: tryAsServiceGas(10n), stateUpdate }]]);

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.validatorsData, initialValidatorsData);
    });

    it("should not update validators data when delegator provides no data", () => {
      const delegatorServiceId = tryAsServiceId(5);
      const otherServiceId = tryAsServiceId(10);
      const state = InMemoryState.empty(tinyChainSpec);
      const initialValidatorsData = createValidatorsData(0);

      const inputState = AccumulationStateUpdateBuilder.new()
        .withPrivilegedServices(createPrivilegedServices())
        .withDelegator(delegatorServiceId)
        .withValidatorsData(initialValidatorsData)
        .get();

      const stateUpdate = AccumulationStateUpdateBuilder.new().get();

      const results = new Map([[otherServiceId, { consumedGas: tryAsServiceGas(10n), stateUpdate }]]);

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.validatorsData, initialValidatorsData);
    });
  });

  describe("mergeAuthorizationQueues", () => {
    function createAuthQueue(fillByte: number): AuthorizerHash[] {
      return Array(AUTHORIZATION_QUEUE_SIZE).fill(Bytes.fill(HASH_SIZE, fillByte).asOpaque());
    }

    it("should update own core authorization queue", () => {
      const manager = tryAsServiceId(1);
      const assignerA = tryAsServiceId(10);
      const assignerB = tryAsServiceId(11);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);

      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: createPrivilegedServices({ manager, assigners }),
      });

      const inputState = AccumulationStateUpdate.empty();

      const newQueue = createAuthQueue(0xaa);

      const stateUpdate = AccumulationStateUpdateBuilder.new().withAuthorizationQueue(0, newQueue).get();

      const results = AccumulationResultsBuilder.new().add(assignerA, stateUpdate).get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.authorizationQueues, stateUpdate.authorizationQueues);
    });

    it("should not update other core authorization queue", () => {
      const manager = tryAsServiceId(1);
      const assignerA = tryAsServiceId(10);
      const assignerB = tryAsServiceId(11);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);

      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: createPrivilegedServices({ manager, assigners }),
      });

      const inputState = AccumulationStateUpdate.empty();

      const newQueue = createAuthQueue(0xaa);

      const stateUpdate = AccumulationStateUpdateBuilder.new().withAuthorizationQueue(0, newQueue).get();

      const results = AccumulationResultsBuilder.new().add(assignerB, stateUpdate).get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.authorizationQueues, new Map());
    });

    it("should not update authorization queue", () => {
      const manager = tryAsServiceId(1);
      const assignerA = tryAsServiceId(10);
      const assignerB = tryAsServiceId(11);
      const assigners = tryAsPerCore([assignerA, assignerB], tinyChainSpec);

      const state = InMemoryState.partial(tinyChainSpec, {
        privilegedServices: createPrivilegedServices({ manager, assigners }),
      });

      const inputState = AccumulationStateUpdate.empty();

      const newQueue = createAuthQueue(0xaa);

      const stateUpdate = AccumulationStateUpdateBuilder.new().withAuthorizationQueue(0, newQueue).get();

      const results = AccumulationResultsBuilder.new().add(manager, stateUpdate).get();

      const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(resultState.authorizationQueues, new Map());
    });
  });

  describe("mergeServices", () => {
    describe("mergePreimages", () => {
      it("should merge preimages provided for current service", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const author = tryAsServiceId(11);

        const preimage = PreimageItem.create({
          hash: Bytes.fill(HASH_SIZE, 0x02).asOpaque(),
          blob: Bytes.fill(5, 0x01),
        });

        const update = UpdatePreimage.provide({ preimage, slot: null, providedFor: author });

        const servicesUpdate = {
          created: [],
          updated: new Map(),
          removed: [],
          preimages: new Map([[author, [update]]]),
          storage: new Map(),
        };

        const stateUpdate = AccumulationStateUpdate.new(servicesUpdate);
        const results = AccumulationResultsBuilder.new().add(author, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.preimages.get(author), [update]);
      });

      it("should route provide updates targeted at another service to that target and leave producer's list empty", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const author = tryAsServiceId(12);
        const target = tryAsServiceId(13);

        const preimage = PreimageItem.create({
          hash: Bytes.fill(HASH_SIZE, 0x03).asOpaque(),
          blob: Bytes.fill(3, 0x05),
        });
        const update = UpdatePreimage.provide({ preimage: preimage, slot: null, providedFor: target });

        const servicesUpdate = {
          created: [],
          updated: new Map(),
          removed: [],
          preimages: new Map([[author, [update]]]),
          storage: new Map(),
        };

        const stateUpdate = AccumulationStateUpdate.new(servicesUpdate);
        const results = AccumulationResultsBuilder.new().add(author, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.preimages.get(author), []);
        deepEqual(resultState.services.preimages.get(target), [update]);
      });
    });

    describe("mergeStorage", () => {
      it("should apply storage updates provided by the service", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const serviceId = tryAsServiceId(5);
        const storageSetUpdate = createStorageSetUpdate(1, 10);
        const storageRemoveUpdate = createStorageRemoveUpdate(2);
        const storageUpdates = [storageSetUpdate, storageRemoveUpdate];

        const stateUpdate = AccumulationStateUpdateBuilder.new().withServiceStorage(serviceId, storageUpdates).get();

        const results = AccumulationResultsBuilder.new().add(serviceId, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.storage.get(serviceId), storageUpdates);
      });
    });

    describe("mergeCreatedServices", () => {
      it("should add newly created services and copy their updates", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const author = tryAsServiceId(1);
        const createdId = tryAsServiceId(200);

        const accountInfo = ServiceAccountInfo.create({
          codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
          balance: tryAsU64(100n),
          accumulateMinGas: tryAsServiceGas(10n),
          onTransferMinGas: tryAsServiceGas(5n),
          storageUtilisationBytes: tryAsU64(0n),
          gratisStorage: tryAsU64(0n),
          storageUtilisationCount: tryAsU32(0),
          created: tryAsTimeSlot(0),
          lastAccumulation: tryAsTimeSlot(0),
          parentService: tryAsServiceId(0),
        });

        const update = UpdateService.create({ serviceInfo: accountInfo, lookupHistory: null });

        const servicesUpdate = {
          created: [createdId],
          updated: new Map([[createdId, update]]),
          removed: [],
          preimages: new Map(),
          storage: new Map(),
        };

        const stateUpdate = AccumulationStateUpdate.new(servicesUpdate);

        const results = AccumulationResultsBuilder.new().add(author, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.created, [createdId]);
        deepEqual(resultState.services.updated.get(createdId), update);
      });
    });

    describe("mergeUpdatedServices", () => {
      it("should copy service update", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const serviceId = tryAsServiceId(10);

        const accountInfo = ServiceAccountInfo.create({
          codeHash: Bytes.zero(HASH_SIZE).asOpaque(),
          balance: tryAsU64(500n),
          accumulateMinGas: tryAsServiceGas(10n),
          onTransferMinGas: tryAsServiceGas(5n),
          storageUtilisationBytes: tryAsU64(0n),
          gratisStorage: tryAsU64(0n),
          storageUtilisationCount: tryAsU32(0),
          created: tryAsTimeSlot(0),
          lastAccumulation: tryAsTimeSlot(0),
          parentService: tryAsServiceId(0),
        });

        const update = UpdateService.update({ serviceInfo: accountInfo });

        const servicesUpdate = {
          created: [],
          updated: new Map([[serviceId, update]]),
          removed: [],
          preimages: new Map(),
          storage: new Map(),
        };

        const stateUpdate = AccumulationStateUpdate.new(servicesUpdate);

        const results = AccumulationResultsBuilder.new().add(serviceId, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.updated.get(serviceId), update);
      });
    });

    describe("mergeRemovedServices", () => {
      it("should copy removed services and their preimage updates", () => {
        const state = InMemoryState.empty(tinyChainSpec);
        const inputState = AccumulationStateUpdate.empty();

        const author = tryAsServiceId(7);
        const removedId = tryAsServiceId(250);

        const removeUpdate = UpdatePreimage.remove({
          hash: Bytes.fill(HASH_SIZE, 0x42).asOpaque(),
          length: tryAsU32(5),
        });

        const servicesUpdate = {
          created: [],
          updated: new Map(),
          removed: [removedId],
          preimages: new Map([[removedId, [removeUpdate]]]),
          storage: new Map(),
        };

        const stateUpdate = AccumulationStateUpdate.new(servicesUpdate);

        const results = AccumulationResultsBuilder.new().add(author, stateUpdate).get();

        const { state: resultState } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

        deepEqual(resultState.services.removed, [removedId]);
        deepEqual(resultState.services.preimages.get(removedId), [removeUpdate]);
      });
    });
  });

  describe("mergeTransfers", () => {
    it("should collect transfers from all service results", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();

      const transfer1 = createTransfer({ source: 1, destination: 2, amount: tryAsU64(100n), gas: 50n });
      const transfer2 = createTransfer({ source: 3, destination: 4, amount: tryAsU64(200n), gas: 75n });

      const results = AccumulationResultsBuilder.new()
        .add(1, AccumulationStateUpdateBuilder.new().withTransfers([transfer1]).get())
        .add(2, AccumulationStateUpdateBuilder.new().withTransfers([transfer2]).get())
        .get();

      const { transfers } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(transfers, [transfer1, transfer2]);
    });

    it("should handle empty transfers from all services", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();

      const results = AccumulationResultsBuilder.new()
        .add(1, AccumulationStateUpdate.empty())
        .add(2, AccumulationStateUpdate.empty())
        .get();

      const { transfers } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(transfers, []);
    });

    it("should handle multiple transfers from a single service", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();

      const transfer1 = createTransfer({ source: 1, destination: 2, amount: tryAsU64(100n), gas: 50n });
      const transfer2 = createTransfer({ source: 1, destination: 3, amount: tryAsU64(150n), gas: 60n });

      const results = AccumulationResultsBuilder.new()
        .add(1, AccumulationStateUpdateBuilder.new().withTransfers([transfer1, transfer2]).get())
        .get();

      const { transfers } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(transfers, [transfer1, transfer2]);
    });
  });

  describe("mergeTotalGas", () => {
    it("should sum consumed gas from parallel results", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();

      const results = AccumulationResultsBuilder.new()
        .add(1, AccumulationStateUpdate.empty(), 10n)
        .add(2, AccumulationStateUpdate.empty(), 20n)
        .get();

      const { totalGasCost } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(totalGasCost, tryAsServiceGas(30n));
    });

    it("should clamp to MAX_VALUE_U64 on overflow", () => {
      const state = InMemoryState.empty(tinyChainSpec);
      const inputState = AccumulationStateUpdate.empty();

      const results = AccumulationResultsBuilder.new()
        .add(1, AccumulationStateUpdate.empty(), MAX_VALUE_U64)
        .add(2, AccumulationStateUpdate.empty(), MAX_VALUE_U64)
        .get();

      const { totalGasCost } = mergePerallelAccumulationResults(tinyChainSpec, state, inputState, results);

      deepEqual(totalGasCost, tryAsServiceGas(MAX_VALUE_U64));
    });
  });
});
