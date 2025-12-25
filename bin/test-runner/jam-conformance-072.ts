import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.2/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",

    // Guarantees: invalid signatures
    "1766243113/00000058.json",
    "1766243147/00000057.json",
    "1766243315_2078/00000121.json",
    "1766243315_3530/00000076.json",
    "1766243493_9922/00000031.json",
    "1766243861_8319/00000119.json",
    "1766243493_6113/00000035.json",
    "1766479507_2200/00000229.json",
    "1766479507_5115/00000087.json",

    // Preimage too big?
    "1766244251_1244/00000124.json",

    // Invalid extrinsic hash?
    "1766255635_1584/00000016.json",

    // Block should be rejected
    "1766565819_2010/00000225.json",

    // Rejecting for invalid work result error "output_oversize" - unspecified behavior
    "1766565819_4872/00000040.json",
    "1766565819_4872/00000041.json",

    // Rejecting for WorkItemsCount: valid behavior
    "1766244251_2939/00001634.json",
    "1766243861_2056/00000022.json",
    "1766243861_5589/00000207.json",
    "1766479507_3250/00000001.json",
    "1766565819_9888/00001868.json",
    // Rejecting for invalid ticket attempt: valid behavior
    "1766244251_1816/00000377.json",
    "1766244122_5414/00000482.json",
    "1766243315_2277/00000123.json",
    "1766565819_7584/00000277.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
