import { type ServiceGas, type ServiceId, tryAsServiceGas } from "@typeberry/block";
import type { ChainSpec } from "@typeberry/config";
import { AccumulationStateUpdate, type PendingTransfer } from "@typeberry/jam-host-calls";
import { MAX_VALUE_U64, sumU64 } from "@typeberry/numbers";
import { PrivilegedServices, tryAsPerCore, UpdatePreimageKind } from "@typeberry/state";
import type { AccumulateState } from "./accumulate-state.js";

export function mergePerallelAccumulationResults(
  chainSpec: ChainSpec,
  state: AccumulateState,
  inputState: AccumulationStateUpdate,
  results: ParallelAccumulationResult,
): MergeResult {
  const mergeContext = createMergeContext(chainSpec, state, inputState, results);

  for (const resultEntry of results) {
    mergePrivilegedServices(mergeContext, resultEntry);
    mergeValidatorsData(mergeContext, resultEntry);
    mergeAuthorizationQueues(mergeContext, resultEntry);
    mergeServices(mergeContext, resultEntry);
    mergeTransfers(mergeContext, resultEntry);
    mergeTotalGas(mergeContext, resultEntry);
  }

  return finalize(mergeContext);
}

type ResultKey = ServiceId;
type ResultValue = { consumedGas: ServiceGas; stateUpdate: AccumulationStateUpdate };
type ResultEntry = [ResultKey, ResultValue];

export type ParallelAccumulationResult = Map<ResultKey, ResultValue>;

export type MergeResult = {
  transfers: PendingTransfer[];
  totalGasCost: ServiceGas;
  state: AccumulationStateUpdate;
};

type MergeContext = {
  outputState: AccumulationStateUpdate;
  transfers: PendingTransfer[];
  totalGasCost: ServiceGas;
  currentPrivilegedServices: PrivilegedServices;
  privilegedServicesUpdatedByManager: PrivilegedServices;
  newCreatedServices: Set<ServiceId>;
  initialCreatedServices: Set<ServiceId>;
  newRemovedServices: Set<ServiceId>;
  initialRemovedServices: Set<ServiceId>;
  chainSpec: ChainSpec;
};

function createMergeContext(
  chainSpec: ChainSpec,
  state: AccumulateState,
  inputState: AccumulationStateUpdate,
  results: ParallelAccumulationResult,
): MergeContext {
  const currentPrivilegedServices = inputState.privilegedServices ?? state.privilegedServices;
  const currentManager = currentPrivilegedServices.manager;
  const privilegedServicesUpdatedByManager =
    results.get(currentManager)?.stateUpdate.privilegedServices ?? currentPrivilegedServices;

  return {
    chainSpec,
    outputState: AccumulationStateUpdate.copyFrom(inputState),
    transfers: [],
    totalGasCost: tryAsServiceGas(0),
    currentPrivilegedServices,
    privilegedServicesUpdatedByManager,
    newCreatedServices: new Set(inputState.services.created),
    initialCreatedServices: new Set(inputState.services.created),
    newRemovedServices: new Set(inputState.services.removed),
    initialRemovedServices: new Set(inputState.services.removed),
  };
}

function updatePrivilegedService(
  currentServiceId: ServiceId,
  serviceIdUpdatedByManager: ServiceId,
  selfUpdatedServiceId: ServiceId,
) {
  if (currentServiceId === serviceIdUpdatedByManager) {
    return selfUpdatedServiceId;
  }

  return serviceIdUpdatedByManager;
}

function mergePrivilegedServices(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const { outputState, currentPrivilegedServices, chainSpec, privilegedServicesUpdatedByManager } = mergeContext;
  const currentManager = currentPrivilegedServices.manager;
  const currentRegistrar = currentPrivilegedServices.registrar;
  const currentDelegator = currentPrivilegedServices.delegator;
  const currentAssigners = currentPrivilegedServices.assigners;
  const { privilegedServices } = stateUpdate;

  if (privilegedServices !== null) {
    if (outputState.privilegedServices === null) {
      outputState.privilegedServices = PrivilegedServices.create({
        ...currentPrivilegedServices,
      });
    }

    if (serviceId === currentManager) {
      outputState.privilegedServices = PrivilegedServices.create({
        ...privilegedServices,
      });
    }

    if (serviceId === currentRegistrar) {
      const newRegistrar = updatePrivilegedService(
        currentPrivilegedServices.registrar,
        privilegedServicesUpdatedByManager.registrar,
        privilegedServices.registrar,
      );

      outputState.privilegedServices = PrivilegedServices.create({
        ...outputState.privilegedServices,
        registrar: newRegistrar,
      });
    }

    if (serviceId === currentDelegator) {
      const newDelegator = updatePrivilegedService(
        currentPrivilegedServices.delegator,
        privilegedServicesUpdatedByManager.delegator,
        privilegedServices.delegator,
      );
      outputState.privilegedServices = PrivilegedServices.create({
        ...outputState.privilegedServices,
        delegator: newDelegator,
      });
    }

    let shouldUpdateAssigners = false;

    const newAssigners = currentAssigners.map((currentAssigner, coreIndex) => {
      if (serviceId === currentAssigner) {
        const newAssigner = updatePrivilegedService(
          currentPrivilegedServices.assigners[coreIndex],
          privilegedServicesUpdatedByManager.assigners[coreIndex],
          privilegedServices.assigners[coreIndex],
        );

        shouldUpdateAssigners = shouldUpdateAssigners || newAssigner !== currentAssigner;

        return newAssigner;
      }

      return currentAssigner;
    });

    if (shouldUpdateAssigners) {
      const newAssignersPerCore = tryAsPerCore(newAssigners, chainSpec);
      outputState.privilegedServices = PrivilegedServices.create({
        ...outputState.privilegedServices,
        assigners: newAssignersPerCore,
      });
    }
  }
}

function mergeValidatorsData(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const { outputState, currentPrivilegedServices } = mergeContext;
  const currentDelegator = currentPrivilegedServices.delegator;
  const { validatorsData } = stateUpdate;

  if (validatorsData !== null && serviceId === currentDelegator) {
    outputState.validatorsData = validatorsData;
  }
}

function mergeAuthorizationQueues(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const { outputState, currentPrivilegedServices } = mergeContext;
  const currentAssigners = currentPrivilegedServices.assigners;
  const { authorizationQueues } = stateUpdate;

  if (authorizationQueues !== null) {
    for (const [core, queue] of authorizationQueues.entries()) {
      if (serviceId === currentAssigners[core]) {
        outputState.authorizationQueues.set(core, queue);
      }
    }
  }
}

function mergeServices(mergeContext: MergeContext, resultEntry: ResultEntry) {
  mergePreimages(mergeContext, resultEntry);
  mergeStorage(mergeContext, resultEntry);
  mergeCreatedServices(mergeContext, resultEntry);
  mergeUpdatedServices(mergeContext, resultEntry);
  mergeRemovedServices(mergeContext, resultEntry);
}

function mergeStorage(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const outputState = mergeContext.outputState;

  const maybeUpdatedStorage = stateUpdate.services.storage.get(serviceId);

  if (maybeUpdatedStorage !== undefined) {
    outputState.services.storage.set(serviceId, maybeUpdatedStorage);
  }
}

function mergePreimages(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const outputState = mergeContext.outputState;
  const maybeUpdatedPreimages = stateUpdate.services.preimages.get(serviceId);

  if (maybeUpdatedPreimages !== undefined) {
    const currentServiceUpdates = maybeUpdatedPreimages.filter(
      (x) => x.action.kind !== UpdatePreimageKind.Provide || x.action.providedFor === serviceId,
    );
    const otherServiceUpdates = maybeUpdatedPreimages.filter(
      (x) => x.action.kind === UpdatePreimageKind.Provide && x.action.providedFor !== serviceId,
    );
    outputState.services.preimages.set(serviceId, currentServiceUpdates);
    for (const update of otherServiceUpdates) {
      if (update.action.kind !== UpdatePreimageKind.Provide) {
        continue;
      }
      const id = update.action.providedFor;
      const preimages = outputState.services.preimages.get(id) ?? [];
      preimages.push(update);
      outputState.services.preimages.set(id, preimages);
    }
  }
}

function mergeCreatedServices(mergeContext: MergeContext, [_serviceId, { stateUpdate }]: ResultEntry) {
  const { outputState, initialCreatedServices, newCreatedServices } = mergeContext;

  const createdServices = stateUpdate.services.created.filter((id) => !initialCreatedServices.has(id));

  for (const id of createdServices) {
    newCreatedServices.add(id);
    const update = stateUpdate.services.updated.get(id);

    if (update !== undefined) {
      outputState.services.updated.set(id, update);
    }
  }
}

function mergeRemovedServices(mergeContext: MergeContext, [_serviceId, { stateUpdate }]: ResultEntry) {
  const { outputState, initialRemovedServices, newRemovedServices } = mergeContext;
  const removedServices = stateUpdate.services.removed.filter((id) => !initialRemovedServices.has(id));

  for (const id of removedServices) {
    newRemovedServices.add(id);
    const preimages = stateUpdate.services.preimages.get(id);

    if (preimages !== undefined) {
      outputState.services.preimages.set(id, preimages);
    }
  }
}

function mergeUpdatedServices(mergeContext: MergeContext, [serviceId, { stateUpdate }]: ResultEntry) {
  const outputState = mergeContext.outputState;
  const maybeUpdatedService = stateUpdate.services.updated.get(serviceId);

  if (maybeUpdatedService !== undefined) {
    outputState.services.updated.set(serviceId, maybeUpdatedService);
  }
}

function mergeTransfers(mergeContext: MergeContext, [_serviceId, { stateUpdate }]: ResultEntry) {
  const { transfers } = mergeContext;
  transfers.push(...stateUpdate.transfers);
}

function mergeTotalGas(mergeContext: MergeContext, [_serviceId, { consumedGas }]: ResultEntry) {
  const { overflow, value } = sumU64(mergeContext.totalGasCost, consumedGas);
  mergeContext.totalGasCost = tryAsServiceGas(overflow ? MAX_VALUE_U64 : value);
}

function finalize(mergeContext: MergeContext): MergeResult {
  const state = mergeContext.outputState;
  state.services.created = Array.from(mergeContext.newCreatedServices);
  state.services.removed = Array.from(mergeContext.newRemovedServices);

  return {
    state,
    totalGasCost: mergeContext.totalGasCost,
    transfers: mergeContext.transfers,
  };
}
