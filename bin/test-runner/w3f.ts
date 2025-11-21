import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/w3f-fluffy", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    "genesis.json",
    // invalid tests
    "host_function",
    // Ignored - not working correctly in 0.6.7 and we ditched fixing them.
    "traces/preimages_light/00000070.json",
    "traces/preimages_light/00000073.json",
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
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
