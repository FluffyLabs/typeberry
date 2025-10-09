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
          // infinite loop during accumulation
          "accumulate/full/transfer_for_ejected_service-1.json",
          // infinite loop during accumulation
          "accumulate/tiny/transfer_for_ejected_service-1.json",
        ]
      : []),
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
