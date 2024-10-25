import { check } from "@typeberry/utils";
import type { HostCallHandler, HostCallIndex } from "./host-call-handler";

// TODO [ToDr] Rename to just `HostCalls`
/** Container for all available host calls. */
export class HostCallsManager {
  private readonly hostCalls = Array<HostCallHandler>();

  constructor(...hostCallHandler: HostCallHandler[]) {
    for (const handler of hostCallHandler) {
      check(this.hostCalls[handler.index] === undefined, `Overwriting host call handler at index ${handler.index}`);
      this.hostCalls[handler.index] = handler;
    }
  }

  /** Get a host call by index. */
  get(hostCallIndex: HostCallIndex): HostCallHandler | null {
    return this.hostCalls[hostCallIndex] ?? null;
  }
}
