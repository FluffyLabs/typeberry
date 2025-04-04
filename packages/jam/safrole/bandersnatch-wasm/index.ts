import { resolve } from "node:path";
import { Executor } from "@typeberry/concurrent";
import type { IExecutor } from "@typeberry/concurrent";
import { Method, Params, type Response } from "./params";
import { worker } from "./worker";

export class BandernsatchWasm {
  private constructor(private readonly executor: IExecutor<Params, Response>) {}

  destroy() {
    return this.executor.destroy();
  }

  static async new({ synchronous }: { synchronous : boolean }) {
    return new BandernsatchWasm(
      !synchronous ? await Executor.initialize<Params, Response>(resolve(__dirname, "./bootstrap.cjs"), {
        minWorkers: 2,
        maxWorkers: 8
      }) : worker,
    );
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

  async verifyTicket(keys: Uint8Array, ticketsData: Uint8Array, contextLength: number) {
    const x = await this.executor.run(
      new Params({
        method: Method.VerifyTickets,
        keys,
        ticketsData,
        contextLength,
      }),
    );
    return x.data;
  }
}
