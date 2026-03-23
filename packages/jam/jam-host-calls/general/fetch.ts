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
 * Fetchable data.
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
export interface IFetchExternalities {
  /**
   * Kind 0: Encoded constants info (𝐜).
   *
   * Always available in all contexts. Returns a fixed encoding of protocol
   * constants: item deposit, byte deposit, core count, gas limits, etc.
   *
   * GP: v = 𝐜 when φ₁₀ = 0
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315001315001?v=0.7.2
   */
  constants(): BytesBlob;

  /**
   * Kind 1: Entropy pool (n).
   *
   * Is-Authorized: ∅ (not available)
   * Refine: H₀ (header hash of anchor block)
   * Accumulate: η'₀ (posterior entropy)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314302314602?v=0.7.2
   */
  entropy(): BytesBlob | null;

  /**
   * Kind 2: Authorizer trace (𝐫).
   *
   * Is-Authorized: ∅ (not available)
   * Refine: 𝐫 (authorizer trace — result of Is-Authorized)
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314902314902?v=0.7.2
   */
  authorizerTrace(): BytesBlob | null;

  /**
   * Kind 3 (other) / Kind 4 (my): Work-item extrinsics (x̄).
   *
   * When workItem is null, uses Kind 4 (current work item's extrinsics).
   * When workItem is provided, uses Kind 3 (other work item's extrinsics),
   * with φ₁₁ = workItem, φ₁₂ = index.
   *
   * Is-Authorized: ∅ (not available)
   * Refine: x̄[φ₁₁][φ₁₂] (other) or x̄[i][φ₁₁] (my)
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315402315402?v=0.7.2
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/317302317302?v=0.7.2
   */
  workItemExtrinsic(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Kind 5 (other) / Kind 6 (my): Import segments (ī).
   *
   * When workItem is null, uses Kind 6 (current work item's imports).
   * When workItem is provided, uses Kind 5 (other work item's imports),
   * with φ₁₁ = workItem, φ₁₂ = index.
   *
   * Is-Authorized: ∅ (not available)
   * Refine: ī[φ₁₁][φ₁₂] (other) or ī[i][φ₁₁] (my)
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/318b02318b02?v=0.7.2
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31aa0231aa02?v=0.7.2
   */
  workItemImport(workItem: U64 | null, index: U64): BytesBlob | null;

  /**
   * Kind 7: Encoded work package
   *
   * Is-Authorized: E(𝐩) (the full work package being authorized)
   * Refine: E(p)
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c10231c102?v=0.7.2
   */
  workPackage(): BytesBlob | null;

  /**
   * Kind 8: Authorizer code hash and config
   *
   * Returns the authorization code hash (32 bytes) concatenated with the
   * authorizer configuration/parametrization blob.
   *
   * Is-Authorized: p_f (from the work package being authorized)
   * Refine: p_f
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31c80231c802?v=0.7.2
   */
  authorizer(): BytesBlob | null;

  /**
   * Kind 9: Authorization token — p_j.
   *
   * Is-Authorized: p_j (from the work package being authorized)
   * Refine: p_j
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31cf0231cf02?v=0.7.2
   */
  authorizationToken(): BytesBlob | null;

  /**
   * Kind 10: Refinement context — E(p_x).
   *
   * Is-Authorized: E(p_x) (from the work package being authorized)
   * Refine: E(p_x)
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31da0231da02?v=0.7.2
   */
  refineContext(): BytesBlob | null;

  /**
   * Kind 11: All work-item summaries — E(↕[S(w) | w ← p_w]).
   *
   * Is-Authorized: from the work package being authorized
   * Refine: from the current work package
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31f40231f402?v=0.7.2
   */
  allWorkItems(): BytesBlob | null;

  /**
   * Kind 12: Single work-item summary — S(p_w[φ₁₁]).
   *
   * S(w) ≡ E(E₄(w_s), w_c, E₈(w_g, w_a), E₂(w_e, |w_i|, |w_x|), E₄(|w_y|)).
   *
   * Is-Authorized: from the work package being authorized
   * Refine: from the current work package
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/31fc0231fc02?v=0.7.2
   */
  oneWorkItem(workItem: U64): BytesBlob | null;

  /**
   * Kind 13: Work-item payload — p_w[φ₁₁]_y.
   *
   * Is-Authorized: from the work package being authorized
   * Refine: from the current work package
   * Accumulate: ∅ (not available)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/313b03313b03?v=0.7.2
   */
  workItemPayload(workItem: U64): BytesBlob | null;

  /**
   * Kind 14: All accumulation operands and transfers — E(↕𝐢).
   *
   * Returns a varlen-encoded sequence of tagged items (tag 0 = operand,
   * tag 1 = transfer).
   *
   * Is-Authorized: ∅ (not available)
   * Refine: ∅ (not available)
   * Accumulate: E(↕𝐢)
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/314e03314e03?v=0.7.2
   */
  allTransfersAndOperands(): BytesBlob | null;

  /**
   * Kind 15: Single accumulation operand or transfer — E(𝐢[φ₁₁]).
   *
   * Each item is tagged: varint 0 = Operand, varint 1 = PendingTransfer.
   *
   * Is-Authorized: ∅ (not available)
   * Refine: ∅ (not available)
   * Accumulate: E(𝐢[φ₁₁])
   *
   * https://graypaper.fluffylabs.dev/#/ab2cdbd/315903315903?v=0.7.2
   */
  oneTransferOrOperand(index: U64): BytesBlob | null;
}

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

    if (kind === FetchKind.AllTransfersAndOperands) {
      return this.fetch.allTransfersAndOperands();
    }

    if (kind === FetchKind.OneTransferOrOperand) {
      const index = regs.get(11);
      return this.fetch.oneTransferOrOperand(index);
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
