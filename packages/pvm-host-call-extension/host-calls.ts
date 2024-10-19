import type { HostCallHandler } from "./host-call-handler";

export class HostCalls {
  private hostCallMap = new Map<number, HostCallHandler>();

  get(hostCallIndex: number): HostCallHandler | null {
    return this.hostCallMap.get(hostCallIndex) ?? null;
  }

  registerHostCall(hostCallIndex: number, hostCallHandler: HostCallHandler) {
    this.hostCallMap.set(hostCallIndex, hostCallHandler);
  }
}
