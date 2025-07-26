import { logger, main } from "./common.js";
import { runners } from "./w3f/runners.js";

main(runners, process.argv.slice(2), "test-vectors/w3f-fluffy", {
  ignored: [
    "traces/",
    // TODO [ToDr] Erasure coding test vectors need to be updated to GP 0.7.0
    "erasure/",
    // TODO [ToDr] Some accumulate tests fail due to incorrect
    // storage bytes counting. This is fixed on `ms-deferred-transfers`
    // so we will uncomment these after the PR is merged.
    "accumulate_ready_queued_reports-1.json",
    "enqueue_and_unlock_chain-3.json",
    "enqueue_and_unlock_simple-2.json",
    "enqueue_and_unlock_with_sr_lookup-2.json",
    "process_one_immediate_report-1.json",
    "queues_are_shifted-1.json",
    "ready_queue_editing-2.json",
    "same_code_different_services-1.json",
  ],
})
  .then((r) => logger.log(r))
  .catch((e) => {
    logger.error(`${e}`);
    process.exit(-1);
  });
