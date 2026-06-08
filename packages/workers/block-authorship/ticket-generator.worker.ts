// biome-ignore-all lint/suspicious/noConsole: worker bootstrap
//
// Worker-thread entry point for parallel ticket generation. Spawned by
// `TicketGeneratorPool` (via the `.mjs` bootstrap), it initialises the native
// bandersnatch binding once and then answers shard requests by running
// `batchGenerateRingVrfForValidators` and returning the raw signature bytes.

import { ConcurrentWorker } from "@typeberry/concurrent";
import { initWasm } from "@typeberry/crypto";
import { BandernsatchWasm } from "@typeberry/safrole/bandersnatch-wasm.js";
import { type TicketGenShardParams, TicketGenShardResult } from "./ticket-pool-protocol.js";

async function main() {
  await initWasm();
  const bandersnatch = await BandernsatchWasm.new();

  const worker = ConcurrentWorker.new<TicketGenShardParams, TicketGenShardResult, BandernsatchWasm>(
    async (params, bs) => {
      const signatures = await bs.batchGenerateRingVrfForValidators(
        params.ringKeysData,
        params.proverKeyIndices,
        params.secretSeedsData,
        params.secretSeedDataLen,
        params.inputsData,
        params.vrfInputDataLen,
      );
      return new TicketGenShardResult(signatures);
    },
    bandersnatch,
  );

  worker.listenToParentPort();
}

main().catch((e) => {
  console.error("ticket-generator worker failed to start:", e);
  process.exit(1);
});
