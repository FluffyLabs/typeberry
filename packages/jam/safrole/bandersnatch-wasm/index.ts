import type {IExecutor} from "@typeberry/concurrent";
import {Executor} from "@typeberry/concurrent";
import {resolve} from "node:path";
import os from 'node:os';
import {Params, type Response} from "./params";
import {worker} from "./worker";

export class BandernsatchWasm {
  private constructor(private readonly executor: IExecutor<Params, Response>) {}

  destroy() {
    return this.executor.destroy();
  }

  static async new({ synchronous }: { synchronous: boolean }) {
    const workers = Math.ceil(os.cpus().length * 2 / 3);
    return new BandernsatchWasm(
      !synchronous
        ? await Executor.initialize<Params, Response>(resolve(__dirname, "./bootstrap.cjs"), {
            minWorkers: workers,
            maxWorkers: workers,
          })
        : worker,
    );
  }

  async getRingCommitment(keys: Uint8Array) {
    const x = await this.executor.run(
      new Params({
        method: 'ring_commitment',
        keys,
      }),
    );
    return x.data;
  }

  async verifyTicket(keys: Uint8Array, ticketsData: Uint8Array, contextLength: number) {
    const x = await this.executor.run(
      new Params({
        method: 'verify_ticket',
        keys,
        ticketsData,
        contextLength,
      }),
    );
    return x.data;
  }
}
