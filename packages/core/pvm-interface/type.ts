import type { OK, Result } from "@typeberry/utils";

/**
 * Gas type for PVM execution.
 */
export type Gas = bigint;

/**
 * PVM execution status.
 *
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e43002e4300?v=0.7.2
 */
export enum PvmStatus {
  OK = 255,
  HALT = 0,
  PANIC = 1,
  FAULT = 2,
  HOST = 3,
  OOG = 4,
}

export interface IPvmRegisters {
  getAllU64(): bigint[];
  getU64(register: number): bigint;
  setU64(register: number, value: bigint): void;
  reset(): void;
  copyFrom(other: IPvmRegisters): void;
}

export type PageFaultAddress = number;

export interface IPvmMemory {
  read(address: number, destination: Uint8Array): Result<OK, PageFaultAddress>;
  write(address: number, source: Uint8Array): Result<OK, PageFaultAddress>;
  reset(): void;
}
