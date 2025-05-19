import os from "node:os";
import { resolve } from "node:path";
import type { IExecutor } from "@typeberry/concurrent";
import { Executor } from "@typeberry/concurrent";
import { Method, Params, type Response } from "./params.js";
import { worker } from "./worker.js";

export class BandernsatchWasm {
  private constructor(private readonly executor: IExecutor<Params, Response>) {}

  destroy() {
    return this.executor.destroy();
  }

  static async new({ synchronous }: { synchronous: boolean }) {
    const workers = os.cpus().length;
    return new BandernsatchWasm(
      !synchronous
        ? await Executor.initialize<Params, Response>(resolve(__dirname, "./bootstrap.cjs"), {
            minWorkers: workers,
            maxWorkers: workers,
          })
        : worker,
    );
  }

  async verifySeal(
    keys: Uint8Array,
    authorIndex: number,
    signature: Uint8Array,
    payload: Uint8Array,
    auxData: Uint8Array,
  ) {
    const x = await this.executor.run(
      new Params({
        method: Method.VerifySeal,
        keys,
        authorIndex,
        signature,
        payload,
        auxData,
      }),
    );
    return x.data;
  }

  async getRingCommitment(keys: Uint8Array) {
    const x = await this.executor.run(
      new Params({
        method: Method.RingCommitment,
        keys,
      }),
    );
    return x.data;
  }

  async batchVerifyTicket(keys: Uint8Array, ticketsData: Uint8Array, contextLength: number) {
    const x = await this.executor.run(
      new Params({
        method: Method.BatchVerifyTickets,
        keys,
        ticketsData,
        contextLength,
      }),
    );
    return x.data;
  }
}
