import type { ServiceId } from "@typeberry/block";
import type { BytesBlob } from "@typeberry/bytes";
import { minU64, tryAsU64, type U32, type U64 } from "@typeberry/numbers";
import type { HostCallHandler, HostCallMemory, HostCallRegisters } from "@typeberry/pvm-host-calls";
import { PvmExecution, traceRegisters, tryAsHostCallIndex } from "@typeberry/pvm-host-calls";
import { type IGasCounter, tryAsSmallGas } from "@typeberry/pvm-interface";
import { logger } from "../logger.js";
import { clampU64ToU32 } from "../utils.js";
import { HostCallResult } from "./results.js";

/**
 * Fetchable data contexts.
 *
 * The fetch host call (ecalli 1) returns context-dependent data based on
 * ω₁₀ (the kind selector). Each invocation context passes different
 * parameters to Ω_Y, which determines which kinds return data vs NONE.
 *
 * Ω_Y signature: Ω_Y(ρ, φ, μ, p, n, r, i, ī, x̄, 𝐢, ...)
 *
 * Context parameter mapping
 *   Is-Authorized: Ω_Y(ρ, φ, μ, 𝐩, ∅, ∅, ∅, ∅, ∅, ∅, ∅)
 *   https://graypaper.fluffylabs.dev/#/ab2cdbd/2e43012e4301?v=0.7.2
 *   Refine:        Ω_Y(ρ, φ, μ, p, H₀, r, i, ī, x̄, ∅, (m,e))
 *   https://graypaper.fluffylabs.dev/#/ab2cdbd/2fe0012fe001?v=0.7.2
 *   Accumulate:    Ω_Y(ρ, φ, μ, ∅, η'₀, ∅, ∅, ∅, ∅, 𝐢, (x,y))
 *   https://graypaper.fluffylabs.dev/#/ab2cdbd/30c00030c000?v=0.7.2
 *
 * Kind availability per context:
 *   Kind 0  (constants)      — all contexts
 *   Kind 1  (n)              — Refine (H₀), Accumulate (η'₀)
 *   Kind 2  (r)              — Refine only
 *   Kind 3-4 (x̄ extrinsics) — Refine only
 *   Kind 5-6 (ī imports)     — Refine only
 *   Kind 7-13 (p work pkg)   — Is-Authorized, Refine
 *   Kind 14-15 (𝐢 acc items) — Accumulate only
 */
export enum FetchContext {
  IsAuthorized = "isAuthorized",
  Refine = "refine",
  Accumulate = "accumulate",
}

/**
 * Fetch externalities for the Is-Authorized context.
 *
 * Ω_Y(ρ, φ, μ, 𝐩, ∅, ∅, ∅, ∅, ∅, ∅, ∅)
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2e43012e4301?v=0.7.2
 *
 * Available kinds: 0 (constants), 7-13 (work package)
 */
export interface IIsAuthorizedFetch {
  readonly context: FetchContext.IsAuthorized;

  /**
   * Kind 0: Encoded constants info (𝐜).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315001315001?v=0.7.2
   */
  constants(): BytesBlob;

  /**
   * Kind 7: Encoded work package — E(𝐩).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c10231c102?v=0.7.2
   */
  workPackage(): BytesBlob | null;

  /**
   * Kind 8: Authorizer code hash and config — p_f.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c80231c802?v=0.7.2
   */
  authorizer(): BytesBlob | null;

  /**
   * Kind 9: Authorization token — p_j.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31cf0231cf02?v=0.7.2
   */
  authorizationToken(): BytesBlob | null;

  /**
   * Kind 10: Refinement context — E(p_x).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31da0231da02?v=0.7.2
   */
  refineContext(): BytesBlob | null;

  /**
   * Kind 11: All work-item summaries — E(↕[S(w) | w ← p_w]).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31f40231f402?v=0.7.2
   */
  allWorkItems(): BytesBlob | null;

  /**
   * Kind 12: Single work-item summary — S(p_w[φ₁₁]).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31fc0231fc02?v=0.7.2
   */
  oneWorkItem(workItem: U64): BytesBlob | null;

  /**
   * Kind 13: Work-item payload — p_w[φ₁₁]_y.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/313b03313b03?v=0.7.2
   */
  workItemPayload(workItem: U64): BytesBlob | null;
}

/**
 * Fetch externalities for the Refine context.
 *
 * Ω_Y(ρ, φ, μ, p, H₀, r, i, ī, x̄, ∅, (m,e))
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/2fe0012fe001?v=0.7.2
 *
 * Available kinds: 0-13 (all except accumulation items)
 */
export interface IRefineFetch {
  readonly context: FetchContext.Refine;

  /**
   * Kind 0: Encoded constants info (𝐜).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315001315001?v=0.7.2
   */
  constants(): BytesBlob;

  /**
   * Kind 1: Entropy pool — H₀ (header hash of anchor block).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314302314602?v=0.7.2
   */
  entropy(): BytesBlob | null;

  /**
   * Kind 2: Authorizer trace (𝐫).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314902314902?v=0.7.2
   */
  authorizerTrace(): BytesBlob | null;

  /**
   * Kind 3 (other) / Kind 4 (my): Work-item extrinsics (x̄).
   *
   * When workItem is null, uses Kind 4 (current work item's extrinsics).
   * When workItem is provided, uses Kind 3 (other work item's extrinsics).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315402315402?v=0.7.2
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/317302317302?v=0.7.2
   */
  workItemExtrinsic(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Kind 5 (other) / Kind 6 (my): Import segments (ī).
   *
   * When workItem is null, uses Kind 6 (current work item's imports).
   * When workItem is provided, uses Kind 5 (other work item's imports).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/318b02318b02?v=0.7.2
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31aa0231aa02?v=0.7.2
   */
  workItemImport(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Kind 7: Encoded work package — E(p).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c10231c102?v=0.7.2
   */
  workPackage(): BytesBlob | null;

  /**
   * Kind 8: Authorizer code hash and config — p_f.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c80231c802?v=0.7.2
   */
  authorizer(): BytesBlob | null;

  /**
   * Kind 9: Authorization token — p_j.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31cf0231cf02?v=0.7.2
   */
  authorizationToken(): BytesBlob | null;

  /**
   * Kind 10: Refinement context — E(p_x).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31da0231da02?v=0.7.2
   */
  refineContext(): BytesBlob | null;

  /**
   * Kind 11: All work-item summaries — E(↕[S(w) | w ← p_w]).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31f40231f402?v=0.7.2
   */
  allWorkItems(): BytesBlob | null;

  /**
   * Kind 12: Single work-item summary — S(p_w[φ₁₁]).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31fc0231fc02?v=0.7.2
   */
  oneWorkItem(workItem: U64): BytesBlob | null;

  /**
   * Kind 13: Work-item payload — p_w[φ₁₁]_y.
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/313b03313b03?v=0.7.2
   */
  workItemPayload(workItem: U64): BytesBlob | null;
}

/**
 * Fetch externalities for the Accumulate context.
 *
 * Ω_Y(ρ, φ, μ, ∅, η'₀, ∅, ∅, ∅, ∅, 𝐢, (x,y))
 * https://graypaper.fluffylabs.dev/#/ab2cdbd/30c00030c000?v=0.7.2
 *
 * Available kinds: 0 (constants), 1 (entropy), 14-15 (accumulation items)
 */
export interface IAccumulateFetch {
  readonly context: FetchContext.Accumulate;

  /**
   * Kind 0: Encoded constants info (𝐜).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315001315001?v=0.7.2
   */
  constants(): BytesBlob;

  /**
   * Kind 1: Entropy pool — η'₀ (posterior entropy).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314302314602?v=0.7.2
   */
  entropy(): BytesBlob | null;

  /**
   * Kind 14: All accumulation operands and transfers — E(↕𝐢).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314e03314e03?v=0.7.2
   */
  allTransfersAndOperands(): BytesBlob | null;

  /**
   * Kind 15: Single accumulation operand or transfer — E(𝐢[φ₁₁]).
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315903315903?v=0.7.2
   */
  oneTransferOrOperand(index: U64): BytesBlob | null;
}

/**
 * Union of all context-specific fetch externality interfaces.
 */
export type IFetchExternalities = IIsAuthorizedFetch | IRefineFetch | IAccumulateFetch;

const IN_OUT_REG = 7;

/**
 * https://graypaper.fluffylabs.dev/#/7e6ff6a/324000324000?v=0.6.7
 */
export class Fetch implements HostCallHandler {
  index = tryAsHostCallIndex(1);
  basicGasCost = tryAsSmallGas(10);
  tracedRegisters = traceRegisters(IN_OUT_REG, 8, 9, 10, 11, 12);

  constructor(
    public readonly currentServiceId: ServiceId,
    private readonly fetch: IFetchExternalities,
  ) {}

  async execute(_gas: IGasCounter, regs: HostCallRegisters, memory: HostCallMemory): Promise<undefined | PvmExecution> {
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
      logger.trace`[${this.currentServiceId}] FETCH(${kind}) <- PANIC`;
      return PvmExecution.Panic;
    }

    logger.trace`[${this.currentServiceId}] FETCH(${kind}) <- ${value?.toStringTruncated()}`;
    logger.insane`[${this.currentServiceId}] FETCH(${kind}) <- ${value}`;

    // write result
    regs.set(IN_OUT_REG, value === null ? HostCallResult.NONE : valueLength);
  }

  private getValue(kind: U32, regs: HostCallRegisters): BytesBlob | null {
    const ext = this.fetch;

    // Kind 0: constants — all contexts
    if (kind === FetchKind.Constants) {
      return ext.constants();
    }

    // Kind 1: entropy — Refine, Accumulate
    if (kind === FetchKind.Entropy) {
      if (ext.context === FetchContext.IsAuthorized) {
        return null;
      }
      return ext.entropy();
    }

    // Kind 2: authorizer trace — Refine only
    if (kind === FetchKind.AuthorizerTrace) {
      if (ext.context !== FetchContext.Refine) {
        return null;
      }
      return ext.authorizerTrace();
    }

    // Kind 3: other work item extrinsics — Refine only
    if (kind === FetchKind.OtherWorkItemExtrinsics) {
      if (ext.context !== FetchContext.Refine) {
        return null;
      }
      const workItem = regs.get(11);
      const index = regs.get(12);
      return ext.workItemExtrinsic(workItem, index);
    }

    // Kind 4: my extrinsics — Refine only
    if (kind === FetchKind.MyExtrinsics) {
      if (ext.context !== FetchContext.Refine) {
        return null;
      }
      const index = regs.get(11);
      return ext.workItemExtrinsic(null, index);
    }

    // Kind 5: other work item imports — Refine only
    if (kind === FetchKind.OtherWorkItemImports) {
      if (ext.context !== FetchContext.Refine) {
        return null;
      }
      const workItem = regs.get(11);
      const index = regs.get(12);
      return ext.workItemImport(workItem, index);
    }

    // Kind 6: my imports — Refine only
    if (kind === FetchKind.MyImports) {
      if (ext.context !== FetchContext.Refine) {
        return null;
      }
      const index = regs.get(11);
      return ext.workItemImport(null, index);
    }

    // Kind 7: work package — Is-Authorized, Refine
    if (kind === FetchKind.WorkPackage) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      return ext.workPackage();
    }

    // Kind 8: authorizer — Is-Authorized, Refine
    if (kind === FetchKind.Authorizer) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      return ext.authorizer();
    }

    // Kind 9: authorization token — Is-Authorized, Refine
    if (kind === FetchKind.AuthorizationToken) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      return ext.authorizationToken();
    }

    // Kind 10: refine context — Is-Authorized, Refine
    if (kind === FetchKind.RefineContext) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      return ext.refineContext();
    }

    // Kind 11: all work items — Is-Authorized, Refine
    if (kind === FetchKind.AllWorkItems) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      return ext.allWorkItems();
    }

    // Kind 12: one work item — Is-Authorized, Refine
    if (kind === FetchKind.OneWorkItem) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      const workItem = regs.get(11);
      return ext.oneWorkItem(workItem);
    }

    // Kind 13: work item payload — Is-Authorized, Refine
    if (kind === FetchKind.WorkItemPayload) {
      if (ext.context === FetchContext.Accumulate) {
        return null;
      }
      const workItem = regs.get(11);
      return ext.workItemPayload(workItem);
    }

    // Kind 14: all transfers and operands — Accumulate only
    if (kind === FetchKind.AllTransfersAndOperands) {
      if (ext.context !== FetchContext.Accumulate) {
        return null;
      }
      return ext.allTransfersAndOperands();
    }

    // Kind 15: one transfer or operand — Accumulate only
    if (kind === FetchKind.OneTransferOrOperand) {
      if (ext.context !== FetchContext.Accumulate) {
        return null;
      }
      const index = regs.get(11);
      return ext.oneTransferOrOperand(index);
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
  AllTransfersAndOperands = 14,
  OneTransferOrOperand = 15,
}
