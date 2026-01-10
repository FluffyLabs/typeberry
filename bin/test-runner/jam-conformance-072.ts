import { logger, main, parseArgs } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, "test-vectors/jam-conformance/fuzz-reports/0.7.2/traces", {
  ...parseArgs(process.argv.slice(2)),
  patterns: [".json"],
  ignored: [
    // genesis file is unparsable
    "genesis.json",

    // Block should be rejected?
    "1766565819_2010/00000225.json",

    // Rejecting for WorkItemsCount: valid behavior
    "1766244251_2939/00001634.json",
    "1766243861_2056/00000022.json",
    "1766243861_5589/00000207.json",
    "1766479507_3250/00000001.json",
    "1766565819_9888/00001868.json",
    "1767871405_3616/00000386.json",
    "1767872928_6833/00003568.json",
    "1767872928_7682/00000035.json",
    "1767895984_2203/00012889.json",
    "1767895984_2519/00008157.json",
    "1767895984_3511/00000469.json",
    "1767895984_4076/00010619.json",
    "1767896003_1048/00005219.json",
    "1767896003_2541/00013907.json",
    // Rejecting for invalid ticket attempt: valid behavior
    "1766244251_1816/00000377.json",
    "1766244122_5414/00000482.json",
    "1766243315_2277/00000123.json",
    "1766565819_7584/00000277.json",
    "1767872928_1994/00000399.json",
    "1767889897_4774/00002350.json",
    "1767889897_7743/00000301.json",
  ],
})
  .then((r) => logger.log`${r}`)
  .catch((e) => {
    logger.error`${e}`;
    process.exit(-1);
  });
