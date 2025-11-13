import { W_E } from "@typeberry/block";
import { G_I, MAX_REPORT_DEPENDENCIES, O, Q, T, W_B, W_C, W_T } from "@typeberry/block/gp-constants.js";
import { MAX_NUMBER_OF_WORK_ITEMS } from "@typeberry/block/work-package.js";
import {
  BASE_SERVICE_BALANCE,
  ELECTIVE_BYTE_BALANCE,
  ELECTIVE_ITEM_BALANCE,
  MAX_RECENT_HISTORY,
} from "@typeberry/state";
import { REPORT_TIMEOUT_GRACE_PERIOD } from "@typeberry/transition/assurances.js";
import { G_A } from "@typeberry/transition/reports/verify-post-signature.js";
import z from "zod";
import { NoArgs, withValidation } from "../types.js";

const V1 = z.object({
  V1: z.object({
    deposit_per_account: z.number(),
    deposit_per_item: z.number(),
    deposit_per_byte: z.number(),
    min_turnaround_period: z.number(),
    epoch_period: z.number(),
    max_accumulate_gas: z.number(),
    max_is_authorized_gas: z.number(),
    max_refine_gas: z.number(),
    block_gas_limit: z.number(),
    recent_block_count: z.number(),
    max_work_items: z.number(),
    max_dependencies: z.number(),
    max_tickets_per_block: z.number(),
    max_lookup_anchor_age: z.number(),
    tickets_attempts_number: z.number(),
    auth_window: z.number(),
    auth_queue_len: z.number(),
    rotation_period: z.number(),
    max_extrinsics: z.number(),
    availability_timeout: z.number(),
    val_count: z.number(),
    max_input: z.number(),
    max_refine_code_size: z.number(),
    basic_piece_len: z.number(),
    max_imports: z.number(),
    max_is_authorized_code_size: z.number(),
    max_exports: z.number(),
    max_refine_memory: z.number(),
    max_is_authorized_memory: z.number(),
    segment_piece_count: z.number(),
    max_report_elective_data: z.number(),
    transfer_memo_size: z.number(),
    epoch_tail_start: z.number(),
    core_count: z.number(),
    slot_period_sec: z.number(),
    max_authorizer_code_size: z.number(),
    max_service_code_size: z.number(),
  }),
});
export type V1 = z.infer<typeof V1>;

/**
 * https://github.com/polkadot-fellows/JIPs/blob/77cba2dcc1887233d4b19371c05284ff761a5fa6/JIP-2.md#chain-parameters
 * Returns the parameters of the current node/chain.
 */
export const parameters = withValidation(NoArgs, V1, async (_params, _db, chainSpec) => {
  return {
    V1: {
      deposit_per_account: Number(BASE_SERVICE_BALANCE),
      deposit_per_item: Number(ELECTIVE_ITEM_BALANCE),
      deposit_per_byte: Number(ELECTIVE_BYTE_BALANCE),
      min_turnaround_period: 32,
      epoch_period: chainSpec.epochLength,
      max_accumulate_gas: G_A,
      max_is_authorized_gas: G_I,
      max_refine_gas: Number(chainSpec.maxRefineGas),
      block_gas_limit: Number(chainSpec.maxBlockGas),
      recent_block_count: MAX_RECENT_HISTORY,
      max_work_items: MAX_NUMBER_OF_WORK_ITEMS,
      max_dependencies: MAX_REPORT_DEPENDENCIES,
      max_tickets_per_block: chainSpec.maxTicketsPerExtrinsic,
      max_lookup_anchor_age: chainSpec.maxLookupAnchorAge,
      tickets_attempts_number: chainSpec.ticketsPerValidator,
      auth_window: O,
      auth_queue_len: Q,
      rotation_period: chainSpec.rotationPeriod,
      max_extrinsics: T,
      availability_timeout: REPORT_TIMEOUT_GRACE_PERIOD,
      val_count: chainSpec.validatorsCount,
      max_input: W_B,
      max_refine_code_size: W_C,
      basic_piece_len: W_E,
      max_imports: 3072,
      max_is_authorized_code_size: 64000,
      max_exports: 3072,
      max_refine_memory: 4096,
      max_is_authorized_memory: 4096,
      segment_piece_count: chainSpec.numberECPiecesPerSegment,
      max_report_elective_data: 49152,
      transfer_memo_size: W_T,
      epoch_tail_start: chainSpec.contestLength,
      core_count: chainSpec.coresCount,
      slot_period_sec: chainSpec.slotDuration,
      max_authorizer_code_size: 64000,
      max_service_code_size: 4000000,
    },
  };
});
