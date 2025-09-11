import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/jam-conformance/fuzz-reports/0.7.0/traces", {
  ignored: [
    "traces/1757063641/00000180.json", // note [seko] test rejected at block parsing stage, which is considered valid behavior
    "traces/1757092821/00000156.json", // note [seko] storage differences, statistics differences (gas used)
    "traces/1757062927/00000091.json", // note [seko] block should be rejected but isn't
    "traces/1756548741/00000059.json", // note [seko] mismatch in storage bytes used and accumulate gas used
    "traces/1757423902/00000148.json", // note [seko] major discrepancy. differences in service info, storage, statistics, recent blocks and accumulation output log
    // note [seko] log message:
    // LOG   [accumulate] Code with hash 0x0000000000000000000000000000000000000000000000000000000000000000 not found for service 3432010466.
    // and there's a difference in statistics: our accumulate gas used: 10000000, should be 0.
    "traces/1757423902/00000152.json",
    "traces/1757423433/00000024.json", // note [seko] The block should be rejected, yet we imported it.
    // note [seko] log message:
    // LOG   [accumulate] Code with hash 0xbaf736ff7927f6f7dfa744a10a67a48b261ae89bbe5c712f7c1f0ee023776661 not found for service 1467575786.
    // difference in storage similar to traces/1757092821/00000156.json
    // difference in statistics
    "traces/1757422206/00000011.json",
    "traces/1757421952/00000011.json", // note [seko] The block should be rejected, yet we imported it.
    "traces/1757421101/00000090.json", // note [seko] different storage values, extra item in accumulation output log, different accumulate gas used
    "traces/1757421101/00000091.json", // note [seko] different storage value, extra items in storage, extra item in accumulation output log, different accumulate gas used
    "traces/1757406558/00000032.json", // note [seko] different storage values, different accumulate gas used
    "traces/1757406516/00000021.json", // note [seko] storage difference, similar to traces/1757092821/00000156.json
    "traces/1757406516/00000022.json", // note [seko] storage difference, similar to traces/1757092821/00000156.json
    "traces/1757406441/00000116.json", // note [seko] storage differences, different accumulate gas used, extra item in accumulation output log
    // note [seko] log message:
    // LOG   [accumulate] Code with hash 0xbaf736ff7927f6f7dfa744a10a67a48b261ae89bbe5c712f7c1f0ee023776661 not found for service 306895876.
    // accumulate gas used should be 0 but isn't
    "traces/1757406356/00000019.json",
    "genesis.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
