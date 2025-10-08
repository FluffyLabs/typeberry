import { Compatibility, GpVersion } from "@typeberry/utils";
import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-fluffy", {
  ignored: [
    "traces/",
    // TODO [ToDr] Erasure coding test vectors need to be updated to GP 0.7.0
    "erasure/",
    // Ignored due to incorrect expected gas
    // https://paritytech.github.io/matrix-archiver/archive/_21ddsEwXlCWnreEGuqXZ_3Apolkadot.io/index.html#$qvS25IbmiyGNWR0kuxhZpukDWP5H7d_5rmUiEJ7KTUI
    "pvm/programs/inst_load_u8_nok.json",
    "pvm/programs/inst_store_imm_indirect_u16_with_offset_nok.json",
    "pvm/programs/inst_store_imm_indirect_u32_with_offset_nok.json",
    "pvm/programs/inst_store_imm_indirect_u64_with_offset_nok.json",
    "pvm/programs/inst_store_imm_indirect_u8_with_offset_nok.json",
    "pvm/programs/inst_store_imm_u8_trap_inaccessible.json",
    "pvm/programs/inst_store_imm_u8_trap_read_only.json",
    "pvm/programs/inst_store_indirect_u16_with_offset_nok.json",
    "pvm/programs/inst_store_indirect_u32_with_offset_nok.json",
    "pvm/programs/inst_store_indirect_u64_with_offset_nok.json",
    "pvm/programs/inst_store_indirect_u8_with_offset_nok.json",
    "pvm/programs/inst_store_u8_trap_inaccessible.json",
    "pvm/programs/inst_store_u8_trap_read_only.json",

    ...(Compatibility.isGreaterOrEqual(GpVersion.V0_7_1)
      ? [
          "accumulate/full/accumulate_ready_queued_reports-1.json",
          "accumulate/full/enqueue_and_unlock_chain_wraps-2.json",
          "accumulate/full/enqueue_and_unlock_chain_wraps-4.json",
          "accumulate/full/enqueue_and_unlock_chain_wraps-5.json",
          "accumulate/full/enqueue_and_unlock_chain-3.json",
          "accumulate/full/enqueue_and_unlock_chain-4.json",
          "accumulate/full/enqueue_and_unlock_simple-2.json",
          "accumulate/full/enqueue_and_unlock_with_sr_lookup-2.json",
          "accumulate/full/process_one_immediate_report-1.json",
          "accumulate/full/queues_are_shifted-1.json",
          "accumulate/full/ready_queue_editing-2.json",
          "accumulate/full/ready_queue_editing-3.json",
          "accumulate/full/same_code_different_services-1.json",
          "accumulate/full/transfer_for_ejected_service-1.json",
          "accumulate/full/work_for_ejected_service-2.json",
          "accumulate/full/work_for_ejected_service-3.json",
          "accumulate/tiny/accumulate_ready_queued_reports-1.json",
          "accumulate/tiny/enqueue_and_unlock_chain_wraps-2.json",
          "accumulate/tiny/enqueue_and_unlock_chain_wraps-4.json",
          "accumulate/tiny/enqueue_and_unlock_chain_wraps-5.json",
          "accumulate/tiny/enqueue_and_unlock_chain-3.json",
          "accumulate/tiny/enqueue_and_unlock_chain-4.json",
          "accumulate/tiny/enqueue_and_unlock_simple-2.json",
          "accumulate/tiny/enqueue_and_unlock_with_sr_lookup-2.json",
          "accumulate/tiny/process_one_immediate_report-1.json",
          "accumulate/tiny/queues_are_shifted-1.json",
          "accumulate/tiny/ready_queue_editing-2.json",
          "accumulate/tiny/ready_queue_editing-3.json",
          "accumulate/tiny/same_code_different_services-1.json",
          "accumulate/tiny/transfer_for_ejected_service-1.json",
          "accumulate/tiny/work_for_ejected_service-2.json",
          "accumulate/tiny/work_for_ejected_service-3.json",
        ]
      : []),
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
