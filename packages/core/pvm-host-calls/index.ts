/**
 * PVM host call implementations.
 *
 * This module provides the Polka Virtual Machine (PVM) host call interface,
 * enabling guest programs to interact with the host environment.
 *
 * @module pvm-host-calls
 */
export { type HostCallHandler, PvmExecution, traceRegisters, tryAsHostCallIndex } from "./host-call-handler.js";
export { HostCallMemory } from "./host-call-memory.js";
export { HostCallRegisters } from "./host-call-registers.js";
export { HostCalls as PvmHostCallExtension } from "./host-calls.js";
export { HostCallsManager as HostCalls } from "./host-calls-manager.js";
export { InterpreterInstanceManager as PvmInstanceManager } from "./interpreter-instance-manager.js";
