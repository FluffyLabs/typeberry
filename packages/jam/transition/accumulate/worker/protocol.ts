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

export enum MessageType {
  AccumulateRequest = 0,
  AccumulateResponse = 1,
  GetServiceRequest = 2,
  GetServiceResponse = 3,
}

/** Main → Worker: request to accumulate a single service. */
export type AccumulateRequest = {
  type: MessageType.AccumulateRequest;
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
  type: MessageType.AccumulateResponse;
  consumedGas: ServiceGas;
  stateUpdate: PlainAccumulationStateUpdate | null;
  error?: string;
};

/** Worker → Main: synchronous request for service data from base state. */
export type GetServiceRequest = {
  type: MessageType.GetServiceRequest;
  serviceId: ServiceId;
};

/** Main → Worker: response with serialized service data. */
export type GetServiceResponse = {
  type: MessageType.GetServiceResponse;
  service: PlainService | null;
};
