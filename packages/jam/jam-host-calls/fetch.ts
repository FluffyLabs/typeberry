import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { minU64, tryAsU64, type U32, type U64 } from "@typeberry/numbers";
import type { HostCallHandler, IHostCallMemory, IHostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type GasCounter, tryAsSmallGas } from "@typeberry/pvm-interpreter/gas.js";
import { Compatibility, GpVersion } from "@typeberry/utils";
import { logger } from "./logger.js";
import { HostCallResult } from "./results.js";
import { clampU64ToU32 } from "./utils.js";

/** Fetchable data. */
export interface IFetchExternalities {
  /**
   * Encoded constants info.
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32de0032e100?v=0.6.6
   */
  constants(): BytesBlob;

  /**
   * Entropy.
   *
   * Is Authorized: `p` (work package?)
   * Refine: `H_0` (might change in the future)
   * Accumulate: `eta_0 prime`
   * On Transfer: `eta_0 prime`
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/325501325501?v=0.6.6
   */
  entropy(): BytesBlob | null;

  /**
   *
   * Authorizer trace.
   *
   * Is Authorized: <empty>
   * Refine: `r` - authorizer trace?
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/325b01325b01?v=0.6.6
   */
  authorizerTrace(): BytesBlob | null;

  /**
   * Inspect currently refined or other work item's extrinsics.
   *
   * Is Authorized: <empty>
   * Refine: `\over(x)[*]`
   *   https://graypaper.fluffylabs.dev/#/9a08063/2fd8002fd800?v=0.6.6
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * Other: https://graypaper.fluffylabs.dev/#/9a08063/326801326801?v=0.6.6
   *    My: https://graypaper.fluffylabs.dev/#/9a08063/327701327701?v=0.6.6
   */
  workItemExtrinsic(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Inspect import segments from current or other work items.
   *
   * Is Authorized: <empty>
   * Refine: `\over(i)[*]`
   *   https://graypaper.fluffylabs.dev/#/9a08063/2e15012e1501?v=0.6.6
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * Other: https://graypaper.fluffylabs.dev/#/9a08063/328501328501?v=0.6.6
   *    My: https://graypaper.fluffylabs.dev/#/9a08063/329601329601?v=0.6.6
   */
  workItemImport(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Inspect encoding of the entire work package.
   *
   * Is Authorized: <empty>
   * Refine: `E(p)`
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/329f0132a201?v=0.6.6
   */
  workPackage(): BytesBlob | null;

  /**
   * Inspect current work package's authorizer:
   * authorizer code hash (`u`) and parametrization (`p`).
   *
   * Is Authorized: <empty>
   * Refine: `E(p_u, ↕p_p)`
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32aa0132aa01?v=0.6.6
   */
  authorizer(): BytesBlob | null;

  /**
   * Inspect authorization token.
   *
   * Is Authorized: <empty>
   * Refine: `p_j`
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32b10132b101?v=0.6.6
   */
  authorizationToken(): BytesBlob | null;

  /**
   * Inspect refine context.
   *
   * Is Authorized: <empty>
   * Refine: `p_x`
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32b80132b801?v=0.6.6
   */
  refineContext(): BytesBlob | null;

  /**
   * Encoding (varlen sequence) of all work items.
   *
   * Is Authorized: <empty>
   * Refine: `E(↕[S(w): w <- p_w ]))`
   *  `S(w)`: https://graypaper.fluffylabs.dev/#/9a08063/32db0132ea01?v=0.6.6
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32cd0132d001?v=0.6.6
   */
  allWorkItems(): BytesBlob | null;

  /**
   * Encoding of a single (selected) work item.
   * `S(w)`: https://graypaper.fluffylabs.dev/#/9a08063/32db0132ea01?v=0.6.6
   *
   * Is Authorized: <empty>
   * Refine: `S(w)`
   *   `S(w)`: https://graypaper.fluffylabs.dev/#/9a08063/32db0132ea01?v=0.6.6
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32d50132d501?v=0.6.6
   */
  oneWorkItem(workItem: U64): BytesBlob | null;

  /**
   * Retrieve work item payload.
   *
   * Is Authorized: <empty>
   * Refine: `p_w[omega_11]_y`
   * Accumulate: <empty>
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32f00132f001?v=0.6.6
   */
  workItemPayload(workItem: U64): BytesBlob | null;

  /**
   * Get all accumulation operands (work results?).
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: `E(↕o)`
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/32fb0132fb01?v=0.6.6
   */
  allOperands(): BytesBlob | null;

  /**
   * Get all accumulation operands (work results?) and transfers.
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: `E(↕o)`
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314c03314c03?v=0.7.2
   */
  allOperandsAndTransfers(): BytesBlob | null;

  /**
   * Get one selected accumulation operand.
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: `E(o[omega_11])`
   * On Transfer: <empty>
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/320202320202?v=0.6.6
   */
  oneOperand(operandIndex: U64): BytesBlob | null;

  /**
   * Get one selected accumulation operand or transfer.
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: `E(o[omega_11])`
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315503315503?v=0.7.2
   */
  oneOperandOrTransfer(index: U64): BytesBlob | null;

  /**
   * Inspect all incoming transfers.
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: <empty>
   * On Transfer: `E(↕t)`
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/320c02320c02?v=0.6.6
   */
  allTransfers(): BytesBlob | null;

  /**
   * Inspect one particular incoming transfers.
   *
   * Is Authorized: <empty>
   * Refine: <empty>
   * Accumulate: <empty>
   * On Transfer: `E(t[omega_11])`
   *
   * https://graypaper.fluffylabs.dev/#/9a08063/321302321302?v=0.6.6
   */
  oneTransfer(transferIndex: U64): BytesBlob | null;
}

const IN_OUT_REG = 7;

/**
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/324000324000?v=0.6.7
 */
export class Fetch implements HostCallHandler {
  index = tryAsHostCallIndex(1);
  gasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11, 12);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly fetch: IFetchExternalities,
  ) {}

  async execute(
    _gas: GasCounter,
    regs: IHostCallRegisters,
    memory: IHostCallMemory,
  ): Promise<undefined | PvmExecution> {
    const fetchKindU64 = regs.get(10);
    const kind = clampU64ToU32(fetchKindU64);
    const value = this.getValue(kind, regs);
    // o
    const output = regs.get(IN_OUT_REG);

    const valueLength = tryAsU64(value?.length ?? 0);
    // f
    const offset = minU64(regs.get(8), valueLength);
    // l
    const length = minU64(regs.get(9), tryAsU64(valueLength - offset));

    // NOTE: casting to `Number` is safe in both places, since we are always bounded
    // by the actual length of the value returned which is smaller than `2*32`.
    const chunk = value === null ? new Uint8Array() : value.raw.subarray(Number(offset), Number(offset + length));
    const storeResult = memory.storeFrom(output, chunk);
    if (storeResult.isError) {
      logger.trace`FETCH(${kind}) <- PANIC`;
      return PvmExecution.Panic;
    }

    logger.trace`FETCH(${kind}) <- ${value?.toStringTruncated()}`;

    // write result
    regs.set(IN_OUT_REG, value === null ? HostCallResult.NONE : valueLength);
  }

  private getValue(kind: U32, regs: IHostCallRegisters): BytesBlob | null {
    if (kind === FetchKind.Constants) {
      return this.fetch.constants();
    }

    if (kind === FetchKind.Entropy) {
      return this.fetch.entropy();
    }

    if (kind === FetchKind.AuthorizerTrace) {
      return this.fetch.authorizerTrace();
    }

    if (kind === FetchKind.OtherWorkItemExtrinsics) {
      const workItem = regs.get(11);
      const index = regs.get(12);
      return this.fetch.workItemExtrinsic(workItem, index);
    }

    if (kind === FetchKind.MyExtrinsics) {
      const index = regs.get(11);
      return this.fetch.workItemExtrinsic(null, index);
    }

    if (kind === FetchKind.OtherWorkItemImports) {
      const workItem = regs.get(11);
      const index = regs.get(12);
      return this.fetch.workItemImport(workItem, index);
    }

    if (kind === FetchKind.MyImports) {
      const index = regs.get(11);
      return this.fetch.workItemImport(null, index);
    }

    if (kind === FetchKind.WorkPackage) {
      return this.fetch.workPackage();
    }

    if (kind === FetchKind.Authorizer) {
      return this.fetch.authorizer();
    }

    if (kind === FetchKind.AuthorizationToken) {
      return this.fetch.authorizationToken();
    }

    if (kind === FetchKind.RefineContext) {
      return this.fetch.refineContext();
    }

    if (kind === FetchKind.AllWorkItems) {
      return this.fetch.allWorkItems();
    }

    if (kind === FetchKind.OneWorkItem) {
      const workItem = regs.get(11);
      return this.fetch.oneWorkItem(workItem);
    }

    if (kind === FetchKind.WorkItemPayload) {
      const workItem = regs.get(11);
      return this.fetch.workItemPayload(workItem);
    }

    if (Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)) {
      if (kind === FetchKind.AllOperandsAndTransfers) {
        return this.fetch.allOperandsAndTransfers();
      }

      if (kind === FetchKind.OneOperandOrTransfer) {
        const index = regs.get(11);
        return this.fetch.oneOperandOrTransfer(index);
      }
    } else {
      if (kind === FetchKind.LegacyAllOperands) {
        return this.fetch.allOperands();
      }

      if (kind === FetchKind.LegacyOneOperand) {
        const index = regs.get(11);
        return this.fetch.oneOperand(index);
      }

      if (kind === FetchKind.LegacyAllTransfers) {
        return this.fetch.allTransfers();
      }

      if (kind === FetchKind.LegacyOneTransfer) {
        const index = regs.get(11);
        return this.fetch.oneTransfer(index);
      }
    }

    return null;
  }
}

export enum FetchKind {
  Constants = 0,
  Entropy = 1,
  AuthorizerTrace = 2,
  OtherWorkItemExtrinsics = 3,
  MyExtrinsics = 4,
  OtherWorkItemImports = 5,
  MyImports = 6,
  WorkPackage = 7,
  Authorizer = 8,
  AuthorizationToken = 9,
  RefineContext = 10,
  AllWorkItems = 11,
  OneWorkItem = 12,
  WorkItemPayload = 13,
  LegacyAllOperands = 14,
  AllOperandsAndTransfers = 14,
  LegacyOneOperand = 15,
  OneOperandOrTransfer = 15,
  LegacyAllTransfers = 16,
  LegacyOneTransfer = 17,
}
