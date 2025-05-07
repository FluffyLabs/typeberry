import type { RpcMethod } from "./types";

export class MethodRegistry {
  private methods: Map<string, RpcMethod> = new Map();

  register(methodName: string, handler: RpcMethod): void {
    this.methods.set(methodName, handler);
  }

  get(methodName: string): RpcMethod | undefined {
    return this.methods.get(methodName);
  }

  has(methodName: string): boolean {
    return this.methods.has(methodName);
  }
}
