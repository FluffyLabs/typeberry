/**
 * Message protocol for main thread ↔ worker communication.
 *
 * All types here must be structured-clone-compatible (no class instances).
 * We use raw Uint8Array instead of Bytes/BytesBlob, plain objects instead of class instances.
 */
import type { ServiceGas, ServiceId, TimeSlot } from "@typeberry/block";
import type { ChainSpec, PvmBackend } from "@typeberry/config";
import type {
  PlainAccumulationStateUpdate,
  PlainOperand,
  PlainPendingTransfer,
  PlainPrivilegedServices,
  PlainService,
} from "./serialization.js";

export const MSG_ACCUMULATE_REQUEST = 0;
export const MSG_ACCUMULATE_RESPONSE = 1;
export const MSG_GET_SERVICE_REQUEST = 2;
export const MSG_GET_SERVICE_RESPONSE = 3;

/** Main → Worker: request to accumulate a single service. */
export type AccumulateRequest = {
  type: typeof MSG_ACCUMULATE_REQUEST;
  serviceId: ServiceId;
  transfers: PlainPendingTransfer[];
  operands: PlainOperand[];
  gasCost: ServiceGas;
  slot: TimeSlot;
  entropy: Uint8Array;
  inputStateUpdate: PlainAccumulationStateUpdate;
  privilegedServices: PlainPrivilegedServices;
  chainSpec: ChainSpec;
  pvmBackend: PvmBackend;
};

/** Worker → Main: result of accumulation. */
export type AccumulateResponse = {
  type: typeof MSG_ACCUMULATE_RESPONSE;
  consumedGas: ServiceGas;
  stateUpdate: PlainAccumulationStateUpdate | null;
  error?: string;
};

/** Worker → Main: request for service data from base state. */
export type GetServiceRequest = {
  type: typeof MSG_GET_SERVICE_REQUEST;
  serviceId: ServiceId;
};

/** Main → Worker: response with serialized service data. */
export type GetServiceResponse = {
  type: typeof MSG_GET_SERVICE_RESPONSE;
  service: PlainService | null;
};
